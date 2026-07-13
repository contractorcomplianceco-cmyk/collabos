import React, { useMemo, useState } from "react";
import { ClipboardCheck, Check, X, RefreshCw, History, Filter } from "lucide-react";
import { PageHeader, ClassificationBadge, RiskBadge, ApprovalRouteBadge, StatusChip, EmptyState, ApprovalPassport } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { canApprove, mapServerRole, needsMySignOff, waitingOnLabel } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";
import { humanLabel, HUMAN_REVIEW_CATEGORY, HUMAN_REVIEW_STATUS } from "@/lib/ui-labels";
import type { Role } from "@/types";

const CATEGORIES = ["all", "duplicate", "team-pulse", "automation", "market", "mind-meld-handoff", "final-decision", "mockup-prompt", "external-intake"] as const;
const STATUS_TONE: Record<string, "amber" | "emerald" | "rose" | "sky"> = { pending: "amber", approved: "emerald", rejected: "rose", "needs-revision": "sky" };

export default function ReviewQueue() {
  const { user } = useAuth();
  const { recommendations, recommendationsLoading, setRecommendationStatus, currentRole } = useAppState();
  const { toast } = useToast();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Prefer live auth role so Rose always gets Sign off when her account is rose_admin.
  const role: Role = user ? mapServerRole(user.role) : currentRole;

  const pending = useMemo(() => recommendations.filter((r) => r.status === "pending"), [recommendations]);
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = { all: pending.length };
    for (const r of pending) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    return counts;
  }, [pending]);

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

  const act = async (id: string, status: "approved" | "rejected" | "needs-revision") => {
    setActingId(id);
    try {
      const ok = await setRecommendationStatus(id, status, role);
      if (!ok) {
        toast({
          title: "Could not update",
          description: "You may not be allowed to sign off on this item, or the request failed.",
          variant: "destructive",
        });
        return;
      }
      const title =
        status === "approved" ? "Signed off" : status === "rejected" ? "Sent back" : "Marked for revision";
      toast({ title, description: "Saved to the shared review queue." });
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Review Queue" subtitle="Things that need your sign-off. Nothing here is approved automatically." icon={ClipboardCheck} accent="rose" />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {CATEGORIES.map((c) => {
          const count = countsByCategory[c] ?? 0;
          const selected = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${selected ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
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
                    onClick={() => setCategory("all")}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                  >
                    Show All ({pending.length})
                  </button>
                  {(countsByCategory["final-decision"] ?? 0) > 0 && category !== "final-decision" && (
                    <button
                      onClick={() => setCategory("final-decision")}
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
        {!recommendationsLoading && filtered.map((r) => {
          const allowed = canApprove(role, r.requiredApprover);
          const myTurn = needsMySignOff(role, r.requiredApprover, r.approvals, r.status);
          const busy = actingId === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={r.source} tone="slate" />
                    <ClassificationBadge value={r.classification} />
                    <RiskBadge value={r.risk} />
                    <ApprovalRouteBadge value={r.requiredApprover} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">{r.recommendation}</p>
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                    <History className="h-3.5 w-3.5" /> {expanded === r.id ? "Hide" : "Show"} history
                  </button>
                  {expanded === r.id && (
                    <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-3">
                      {r.history.map((h) => (
                        <li key={h.id} className="text-xs text-slate-500"><span className="font-medium text-slate-600">{h.actor}</span> — {h.action} <span className="text-slate-300">· {h.timestamp}</span></li>
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
                          disabled={busy}
                          onClick={() => void act(r.id, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Sign off
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void act(r.id, "needs-revision")}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Revise
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void act(r.id, "rejected")}
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
        })}
      </div>
    </div>
  );
}
