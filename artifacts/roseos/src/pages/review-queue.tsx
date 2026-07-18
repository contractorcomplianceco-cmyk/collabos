import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ClipboardCheck, Check, X, RefreshCw, History, Filter, FolderKanban, MessageSquare, Send, UserPlus, ListPlus } from "lucide-react";
import { PageHeader, ClassificationBadge, RiskBadge, ApprovalRouteBadge, StatusChip, EmptyState, ApprovalPassport } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useListDirectory } from "@workspace/api-client-react";
import { canApprove, mapServerRole, needsMySignOff, waitingOnLabel } from "@/lib/helpers";
import { linkifyRecommendation } from "@/lib/linkify";
import { useToast } from "@/hooks/use-toast";
import { getStickyFilter, setStickyFilter } from "@/lib/nav-prefs";
import { humanLabel, HUMAN_REVIEW_CATEGORY, HUMAN_REVIEW_STATUS } from "@/lib/ui-labels";
import type { Role, Recommendation } from "@/types";

const CATEGORIES = ["all", "duplicate", "team-pulse", "automation", "market", "mind-meld-handoff", "final-decision", "mockup-prompt", "external-intake"] as const;
const STATUS_TONE: Record<string, "amber" | "emerald" | "rose" | "sky"> = { pending: "amber", approved: "emerald", rejected: "rose", "needs-revision": "sky" };

function initialCategory(userKey: string): (typeof CATEGORIES)[number] {
  const saved = getStickyFilter(userKey, "review-queue");
  return (CATEGORIES as readonly string[]).includes(saved) ? (saved as (typeof CATEGORIES)[number]) : "all";
}

export default function ReviewQueue() {
  const { user } = useAuth();
  const {
    recommendations,
    recommendationsLoading,
    setRecommendationStatus,
    commentOnRecommendation,
    handoffRecommendationTo,
    createProjectTaskEntry,
    currentRole,
    projects,
  } = useAppState();
  const { data: directory = [] } = useListDirectory();
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const userKey = user?.email ?? String(user?.id ?? currentRole);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(() => initialCategory(userKey));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filtersRemembered, setFiltersRemembered] = useState(false);
  const [didAutoFallback, setDidAutoFallback] = useState(false);
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Prefer live auth role so Rose always gets Sign off when her account is rose_admin.
  const role: Role = user ? mapServerRole(user.role) : currentRole;

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const focus = params.get("focus");
    if (focus) setExpanded(focus);
  }, [search]);

  useEffect(() => {
    if (!expanded) return;
    const el = cardRefs.current[expanded];
    if (el) {
      window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }, [expanded, recommendationsLoading]);

  const chooseCategory = (c: (typeof CATEGORIES)[number]) => {
    setCategory(c);
    setStickyFilter(userKey, "review-queue", c);
    setFiltersRemembered(true);
  };

  const projectNameById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const pending = useMemo(() => recommendations.filter((r) => r.status === "pending"), [recommendations]);
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: pending.length };
    for (const r of pending) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return counts;
  }, [pending]);

  // If the remembered filter has nothing pending, fall back to Final decisions or All.
  useEffect(() => {
    if (recommendationsLoading || didAutoFallback) return;
    if (category === "all") {
      setDidAutoFallback(true);
      return;
    }
    const pendingInCat = countsByCategory[category] ?? 0;
    if (pendingInCat === 0 && pending.length >= 0) {
      const next =
        (countsByCategory["final-decision"] ?? 0) > 0 ? "final-decision" : "all";
      if (next !== category) {
        setCategory(next);
        setStickyFilter(userKey, "review-queue", next);
        setFiltersRemembered(true);
      }
    }
    setDidAutoFallback(true);
  }, [recommendationsLoading, didAutoFallback, category, countsByCategory, pending.length, userKey]);

  const filtered = recommendations.filter((r) => category === "all" || r.category === category);

  const otherBusyTabs = useMemo(() => {
    if (category === "all") return [];
    return (["final-decision", "external-intake", "duplicate", "automation", "market", "mind-meld-handoff", "mockup-prompt", "team-pulse"] as const)
      .filter((c) => c !== category && (countsByCategory[c] ?? 0) > 0)
      .sort((a, b) => (countsByCategory[b] ?? 0) - (countsByCategory[a] ?? 0));
  }, [category, countsByCategory]);

  const emptyMessage = (() => {
    if (category === "all" || pending.length === 0) return "Nothing waiting for sign-off right now.";
    const label = humanLabel(HUMAN_REVIEW_CATEGORY, category);
    if (otherBusyTabs.length > 0) {
      const top = otherBusyTabs.slice(0, 2).map((c) => `${humanLabel(HUMAN_REVIEW_CATEGORY, c)} (${countsByCategory[c]})`).join(" or ");
      return `Nothing in ${label} — try All (${pending.length}) or ${top}.`;
    }
    return `Nothing in ${label}.`;
  })();

  const emptyHint = pending.length === 0
    ? "New items land here from Incoming Messages, Mockup Studio, Duplicate Radar, and Mind Meld — and always wait for a person to decide."
    : category !== "all"
      ? "This filter only shows one category. Rose decision items usually sit under Final decisions."
      : "New items land here from Incoming Messages, Mockup Studio, Duplicate Radar, and Mind Meld — and always wait for a person to decide.";

  const act = async (id: string, status: "approved" | "rejected" | "needs-revision", note?: string) => {
    setActingId(id);
    try {
      const ok = await setRecommendationStatus(id, status, role, note);
      if (!ok) {
        toast({
          title: "Could not update",
          description: "You may not be allowed to sign off on this item, or the request failed.",
          variant: "destructive",
        });
        return;
      }
      if (status === "approved") {
        toast({
          title: "Signed off — added to Carmen’s open work",
          description: "A project task was created or updated so Carmen can pick it up in today’s path.",
        });
      } else {
        const title = status === "rejected" ? "Sent back" : "Marked for revision";
        toast({ title, description: "Saved to the shared review queue." });
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Review Queue"
        subtitle="Stamp decisions — things that need your sign-off. Nothing here is approved automatically. When Rose Signs off, Carmen’s open work and today’s path update next."
        icon={ClipboardCheck}
        accent="rose"
      />

      <div className="-mx-6 flex items-center gap-2 overflow-x-auto px-6 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <Filter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {CATEGORIES.map((c) => {
          const count = countsByCategory[c] ?? 0;
          const selected = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => chooseCategory(c)}
              aria-pressed={selected}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${selected ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {humanLabel(HUMAN_REVIEW_CATEGORY, c)}
              {count > 0 && (
                <span className={`ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {filtersRemembered || getStickyFilter(userKey, "review-queue") ? (
          <span className="shrink-0 text-[10px] text-slate-400">Filters remembered for you</span>
        ) : null}
      </div>

      <div className="space-y-3">
        {recommendationsLoading && (
          <p className="py-10 text-center text-sm text-slate-400">Loading items waiting on you…</p>
        )}
        {!recommendationsLoading && filtered.length === 0 && (
          <EmptyState
            message={emptyMessage}
            hint={emptyHint}
            action={
              category !== "all" && pending.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => chooseCategory("all")}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                  >
                    Show All ({pending.length})
                  </button>
                  {(countsByCategory["final-decision"] ?? 0) > 0 && category !== "final-decision" && (
                    <button
                      onClick={() => chooseCategory("final-decision")}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Final decisions ({countsByCategory["final-decision"]})
                    </button>
                  )}
                </div>
              ) : undefined
            }
          />
        )}
        {!recommendationsLoading && filtered.map((r) => (
          <ReviewCard
            key={r.id}
            r={r}
            role={role}
            busy={actingId === r.id}
            expanded={expanded === r.id}
            onToggleExpand={() => setExpanded(expanded === r.id ? null : r.id)}
            projectName={r.projectId ? projectNameById[r.projectId] ?? null : null}
            cardRef={(el) => { cardRefs.current[r.id] = el; }}
            directory={directory}
            onAct={act}
            onComment={commentOnRecommendation}
            onHandoff={handoffRecommendationTo}
            onConvertToTask={async (rec) => {
              await createProjectTaskEntry({
                title: rec.recommendation.slice(0, 120),
                projectId: rec.projectId ?? "",
                owner: rec.assignedTo ?? null,
              });
            }}
            toast={toast}
          />
        ))}
      </div>
    </div>
  );
}

interface DirMember { id: number; name: string; role: string }

function ReviewCard({
  r, role, busy, expanded, onToggleExpand, projectName, cardRef, directory,
  onAct, onComment, onHandoff, onConvertToTask, toast,
}: {
  r: Recommendation;
  role: Role;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  projectName: string | null;
  cardRef: (el: HTMLDivElement | null) => void;
  directory: DirMember[];
  onAct: (id: string, status: "approved" | "rejected" | "needs-revision", note?: string) => Promise<void>;
  onComment: (id: string, note: string) => Promise<boolean>;
  onHandoff: (id: string, assignedTo: string, assignedToId?: number | null, note?: string) => Promise<boolean>;
  onConvertToTask: (rec: Recommendation) => Promise<void>;
  toast: (t: { title: string; description?: string; variant?: "destructive" }) => void;
}) {
  const allowed = canApprove(role, r.requiredApprover);
  const myTurn = needsMySignOff(role, r.requiredApprover, r.approvals, r.status);
  const projectHubHref = r.projectId ? `/projects?expand=${encodeURIComponent(r.projectId)}` : null;

  // Panels: only one open at a time keeps the card compact.
  const [panel, setPanel] = useState<null | "comment" | "handoff" | "note">(null);
  const [pendingStatus, setPendingStatus] = useState<"rejected" | "needs-revision" | null>(null);
  const [commentText, setCommentText] = useState("");
  const [handoffTo, setHandoffTo] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const comments = r.history.filter((h) => h.kind === "comment");

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSaving(true);
    const ok = await onComment(r.id, commentText);
    setSaving(false);
    if (ok) { setCommentText(""); setPanel(null); toast({ title: "Reply added" }); }
  };

  const submitHandoff = async () => {
    if (!handoffTo.trim()) return;
    setSaving(true);
    const member = directory.find((m) => m.name === handoffTo);
    const ok = await onHandoff(r.id, handoffTo, member?.id ?? null, handoffNote);
    setSaving(false);
    if (ok) { setHandoffTo(""); setHandoffNote(""); setPanel(null); toast({ title: `Handed off to ${handoffTo}` }); }
  };

  const submitNote = async () => {
    if (!pendingStatus) return;
    setSaving(true);
    await onAct(r.id, pendingStatus, noteText);
    setSaving(false);
    setNoteText(""); setPanel(null); setPendingStatus(null);
  };

  const startNote = (status: "rejected" | "needs-revision") => {
    setPendingStatus(status);
    setNoteText("");
    setPanel("note");
  };

  return (
            <div
              ref={cardRef}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition ${expanded ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200"}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={r.source} tone="slate" />
                    <ClassificationBadge value={r.classification} />
                    <RiskBadge value={r.risk} />
                    <ApprovalRouteBadge value={r.requiredApprover} />
                    {projectName && projectHubHref ? (
                      <Link
                        href={projectHubHref}
                        className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100 hover:bg-sky-100"
                      >
                        <FolderKanban className="h-3 w-3" />
                        {projectName}
                      </Link>
                    ) : null}
                    {r.assignedTo ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
                        <UserPlus className="h-3 w-3" /> {r.assignedTo}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">{linkifyRecommendation(r.recommendation)}</p>

                  {/* Interaction toolbar: reply, hand off, quick actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPanel(panel === "comment" ? null : "comment")}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Reply{comments.length > 0 ? ` (${comments.length})` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel(panel === "handoff" ? null : "handoff")}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Hand off
                    </button>
                    {r.projectId ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => { setSaving(true); await onConvertToTask(r); setSaving(false); toast({ title: "Added to project tasks" }); }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                      >
                        <ListPlus className="h-3.5 w-3.5" /> Convert to task
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onToggleExpand}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      <History className="h-3.5 w-3.5" /> {expanded ? "Hide" : "Show"} history
                    </button>
                  </div>

                  {/* Reply panel */}
                  {panel === "comment" && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      {comments.length > 0 && (
                        <ul className="mb-2 space-y-2">
                          {comments.map((h) => (
                            <li key={h.id} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                              <span className="font-semibold text-slate-700">{h.actor}</span>
                              <span className="text-slate-300"> · {h.timestamp}</span>
                              <p className="mt-0.5 text-slate-600">{h.note}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-end gap-2">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={2}
                          placeholder="Write a reply…"
                          className="field-input flex-1 text-sm"
                        />
                        <button
                          type="button"
                          disabled={saving || !commentText.trim()}
                          onClick={() => void submitComment()}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" /> Send
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Handoff panel */}
                  {panel === "handoff" && (
                    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                      <select
                        value={handoffTo}
                        onChange={(e) => setHandoffTo(e.target.value)}
                        className="field-input w-full text-sm"
                      >
                        <option value="">Hand off to…</option>
                        {directory.map((m) => (
                          <option key={m.id} value={m.name}>{m.name}{m.role ? ` · ${m.role.replace(/_/g, " ")}` : ""}</option>
                        ))}
                      </select>
                      <input
                        value={handoffNote}
                        onChange={(e) => setHandoffNote(e.target.value)}
                        placeholder="Note (optional) — what do you need from them?"
                        className="field-input w-full text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving || !handoffTo.trim()}
                        onClick={() => void submitHandoff()}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Hand off
                      </button>
                    </div>
                  )}

                  {/* Note-on-decision panel */}
                  {panel === "note" && pendingStatus && (
                    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-600">
                        {pendingStatus === "rejected" ? "Send back — add a reason" : "Request revision — what should change?"}
                      </p>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        placeholder="Add a note (optional)…"
                        className="field-input w-full text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void submitNote()}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${pendingStatus === "rejected" ? "bg-rose-500 hover:bg-rose-600" : "bg-sky-500 hover:bg-sky-600"}`}
                        >
                          {pendingStatus === "rejected" ? <><X className="h-3.5 w-3.5" /> Send back</> : <><RefreshCw className="h-3.5 w-3.5" /> Request revision</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPanel(null); setPendingStatus(null); }}
                          className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {expanded && (
                    <ul className="mt-3 space-y-1 border-l-2 border-slate-100 pl-3">
                      {r.history.map((h) => (
                        <li key={h.id} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{h.actor}</span> — {h.action}
                          {h.note ? <span className="text-slate-500">: “{h.note}”</span> : null}
                          <span className="text-slate-300"> · {h.timestamp}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ApprovalPassport requiredApprover={r.requiredApprover} approvals={r.approvals} status={r.status} />
                  {r.requiredApprover === "both" && r.status === "pending" && (r.approvals?.rose || r.approvals?.carmen) && (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {r.approvals?.rose ? "Rose signed off" : "Carmen signed off"} · awaiting {r.approvals?.rose ? "Carmen" : "Rose"}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                  {r.status === "pending" ? (
                    myTurn ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onAct(r.id, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Sign off
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startNote("needs-revision")}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Revise
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startNote("rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Send back
                        </button>
                      </>
                    ) : allowed ? (
                      <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                        You signed off · awaiting {role === "Rose" ? "Carmen" : "Rose"}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                        {waitingOnLabel(r.requiredApprover)}
                      </span>
                    )
                  ) : (
                    <StatusChip label={humanLabel(HUMAN_REVIEW_STATUS, r.status)} tone={STATUS_TONE[r.status]} />
                  )}
                  </div>
                </div>
              </div>
            </div>
  );
}
