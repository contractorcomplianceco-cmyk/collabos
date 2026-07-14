import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Download,
  GitBranch,
  MessageSquarePlus,
  Paperclip,
  PlayCircle,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  listAgentWorkAttachments,
  uploadAgentWorkAttachment,
  type AgentWorkAttachmentRecord,
} from "@workspace/api-client-react";
import { ApprovalRouteBadge, EmptyState, PageHeader, RiskBadge, SectionCard, StatusChip } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getStickyFilter, setStickyFilter } from "@/lib/nav-prefs";
import { humanLabel, HUMAN_AGENT_STATUS } from "@/lib/ui-labels";
import type { AgentWorkItem, AgentWorkPriority, AgentWorkStatus, AgentWorkType, ApprovalRoute, RiskLevel } from "@/types";
import { useSearch } from "wouter";

const WORK_TYPES: AgentWorkType[] = ["bug", "fix", "improvement", "ops", "question", "integration-prep"];
const PRIORITIES: AgentWorkPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: AgentWorkStatus[] = ["new", "triaged", "approved-for-agent", "in-progress", "blocked", "ready-for-review", "done", "rejected"];
const MODULES = ["Cursor Direct Requests", "External Intake", "Review Queue", "Mind Meld", "Market Pulse", "Settings", "Integrations", "Operations", "Other"];

const ACCEPT_TYPES =
  ".zip,.md,.html,.htm,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,.json,.pptx,.ppt,.rtf";
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const STATUS_TONE: Record<AgentWorkStatus, "slate" | "sky" | "amber" | "violet" | "rose" | "emerald" | "orange"> = {
  new: "slate",
  triaged: "sky",
  "approved-for-agent": "violet",
  "in-progress": "amber",
  blocked: "rose",
  "ready-for-review": "orange",
  done: "emerald",
  rejected: "slate",
};

const PRIORITY_TONE: Record<AgentWorkPriority, "slate" | "amber" | "rose" | "orange"> = {
  low: "slate",
  medium: "amber",
  high: "orange",
  urgent: "rose",
};

function splitSteps(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

async function uploadFileForItem(itemId: number, file: File): Promise<AgentWorkAttachmentRecord> {
  return uploadAgentWorkAttachment(itemId, {
    filename: file.name,
    contentBase64: await fileToBase64(file),
    mimeType: file.type || undefined,
  });
}

function AgentProtocol() {
  return (
    <SectionCard title="How this works" icon={ShieldCheck} accent="violet">
      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div className="rounded-xl bg-violet-50/60 p-3">
          <p className="font-semibold text-violet-700">1. You ask</p>
          <p className="mt-1 text-xs">Rose, Carmen, or an approved teammate logs a specific request with the outcome you want.</p>
        </div>
        <div className="rounded-xl bg-sky-50/60 p-3">
          <p className="font-semibold text-sky-700">2. You approve</p>
          <p className="mt-1 text-xs">Cursor only picks up work you've signed off on.</p>
        </div>
        <div className="rounded-xl bg-emerald-50/60 p-3">
          <p className="font-semibold text-emerald-700">3. You review</p>
          <p className="mt-1 text-xs">Notes, checks, and what changed are written back here for you to review.</p>
        </div>
      </div>
    </SectionCard>
  );
}

function AttachFilesForCarmen({
  itemId,
  canUpload,
}: {
  itemId: number;
  canUpload: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AgentWorkAttachmentRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const rows = await listAgentWorkAttachments(itemId);
      setAttachments(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [itemId]);

  const handleUpload = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({ title: "File too large", description: "Maximum size is 25 MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await uploadFileForItem(itemId, file);
      toast({ title: "File attached", description: `${file.name} is ready for Carmen.` });
      await refresh();
    } catch {
      toast({
        title: "Couldn’t attach file",
        description: "Check the file type and try again. Executables aren’t allowed.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SectionCard title="Attach files for Carmen" icon={Paperclip} accent="rose" className="shadow-none lg:col-span-2">
      <p className="text-xs text-slate-500">
        Add briefs, zips, PDFs, docs, screenshots, or HTML/Markdown for Carmen and Cursor. Max 25 MB each.
      </p>
      {canUpload && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_TYPES}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload file"}
          </button>
        </div>
      )}
      <ul className="mt-3 space-y-2">
        {loading ? (
          <li className="text-sm text-slate-400">Loading attachments…</li>
        ) : attachments.length === 0 ? (
          <li className="text-sm text-slate-400">No files attached yet.</li>
        ) : (
          attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{a.filename}</span>
              <span className="text-[11px] text-slate-400">
                {formatBytes(a.sizeBytes)} · {a.uploadedBy} · {new Date(a.uploadedAt).toLocaleDateString()}
              </span>
              <a
                href={`/api/agent-work/items/${itemId}/attachments/${a.id}/download`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
}

function WorkItemCard({
  item,
  canManage,
  canUpload,
  onUpdate,
  onEvent,
  focused,
  wrapRef,
}: {
  item: AgentWorkItem;
  canManage: boolean;
  canUpload: boolean;
  onUpdate: (id: string, patch: Parameters<ReturnType<typeof useAppState>["updateAgentWork"]>[1]) => void;
  onEvent: (id: string, action: string, note?: string) => void;
  focused?: boolean;
  wrapRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(focused ?? false);
  const [status, setStatus] = useState<AgentWorkStatus>(item.status);
  const [priority, setPriority] = useState<AgentWorkPriority>(item.priority);
  const [agentNotes, setAgentNotes] = useState(item.agentNotes);
  const [branchName, setBranchName] = useState(item.branchName ?? "");
  const [commitSha, setCommitSha] = useState(item.commitSha ?? "");
  const [mergeRequestUrl, setMergeRequestUrl] = useState(item.mergeRequestUrl ?? "");
  const [finalOutcome, setFinalOutcome] = useState(item.finalOutcome ?? "");
  const [verificationText, setVerificationText] = useState(item.verificationSteps.join("\n"));
  const [eventAction, setEventAction] = useState("");
  const [eventNote, setEventNote] = useState("");

  const save = () => {
    onUpdate(item.id, {
      status,
      priority,
      agentNotes,
      branchName: branchName || null,
      commitSha: commitSha || null,
      mergeRequestUrl: mergeRequestUrl || null,
      finalOutcome: finalOutcome || null,
      verificationSteps: splitSteps(verificationText),
    });
  };

  const addEvent = () => {
    if (!eventAction.trim()) return;
    onEvent(item.id, eventAction.trim(), eventNote.trim() || undefined);
    setEventAction("");
    setEventNote("");
  };

  return (
    <div ref={wrapRef} className={`rounded-2xl border bg-white p-5 shadow-sm ${focused ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-200"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={humanLabel(HUMAN_AGENT_STATUS, item.status)} tone={STATUS_TONE[item.status]} />
            <StatusChip label={item.priority} tone={PRIORITY_TONE[item.priority]} />
            <StatusChip label={item.requestType} tone="sky" />
            <RiskBadge value={item.risk} />
            <ApprovalRouteBadge value={item.approvalRoute} />
            {(item.attachmentCount ?? 0) > 0 ? (
              <StatusChip
                label={`Rose attached files (${item.attachmentCount})`}
                tone="rose"
              />
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Desired outcome:</span> {item.desiredOutcome}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span>{item.affectedModule}</span>
            <span>Source: {item.source}</span>
            {item.owner && <span>Owner: {item.owner}</span>}
            {item.createdByName && <span>Created by {item.createdByName}</span>}
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">
          {open ? "Hide details" : "Open details"}
        </button>
      </div>

      {open && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Update progress" icon={GitBranch} accent="sky" className="shadow-none">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-500">
                  Status
                  <select disabled={!canManage} value={status} onChange={(e) => setStatus(e.target.value as AgentWorkStatus)} className="field-input mt-1">
                    {STATUSES.map((s) => <option key={s} value={s}>{humanLabel(HUMAN_AGENT_STATUS, s)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Priority
                  <select disabled={!canManage} value={priority} onChange={(e) => setPriority(e.target.value as AgentWorkPriority)} className="field-input mt-1">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs text-slate-500">
                Agent notes
                <textarea disabled={!canManage} value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} rows={3} className="field-input mt-1" placeholder="What happened, what was found, or what's still needed." />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <input disabled={!canManage} value={branchName} onChange={(e) => setBranchName(e.target.value)} className="field-input" placeholder="Branch" />
                <input disabled={!canManage} value={commitSha} onChange={(e) => setCommitSha(e.target.value)} className="field-input" placeholder="Commit SHA" />
                <input disabled={!canManage} value={mergeRequestUrl} onChange={(e) => setMergeRequestUrl(e.target.value)} className="field-input" placeholder="MR / PR URL" />
              </div>
              <label className="block text-xs text-slate-500">
                Verification steps
                <textarea disabled={!canManage} value={verificationText} onChange={(e) => setVerificationText(e.target.value)} rows={3} className="field-input mt-1" placeholder="One verification step per line" />
              </label>
              <label className="block text-xs text-slate-500">
                Final outcome
                <textarea disabled={!canManage} value={finalOutcome} onChange={(e) => setFinalOutcome(e.target.value)} rows={2} className="field-input mt-1" placeholder="What Rose or Carmen should review." />
              </label>
              {canManage && (
                <button onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save update
                </button>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Event History" icon={ClipboardList} accent="violet" className="shadow-none">
            <ul className="max-h-72 space-y-2 overflow-y-auto border-l-2 border-slate-100 pl-3">
              {item.events.map((event) => (
                <li key={event.id} className="text-xs text-slate-500">
                  <p><span className="font-semibold text-slate-700">{event.actor}</span> — {event.action}</p>
                  {event.note && <p className="mt-0.5 text-slate-400">{event.note}</p>}
                  <p className="text-[10px] text-slate-300">{event.timestamp}</p>
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-4 space-y-2">
                <input value={eventAction} onChange={(e) => setEventAction(e.target.value)} className="field-input" placeholder="Event action, e.g. Deployed and verified" />
                <textarea value={eventNote} onChange={(e) => setEventNote(e.target.value)} rows={2} className="field-input" placeholder="Optional evidence or blocker note" />
                <button onClick={addEvent} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-600">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Add event
                </button>
              </div>
            )}
          </SectionCard>

          <AttachFilesForCarmen itemId={Number(item.id)} canUpload={canUpload} />
        </div>
      )}
    </div>
  );
}

export default function AgentQueue() {
  const { agentWorkItems, agentWorkLoading, createAgentWork, updateAgentWork, addAgentWorkItemEvent } = useAppState();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const userKey = user?.email ?? String(user?.id ?? "anon");
  const canManage = hasPermission("agent_work_manage");
  const canUpload =
    hasPermission("agent_work_manage") ||
    hasPermission("brain_suggest") ||
    hasPermission("external_intake_act");
  const createFileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AgentWorkStatus | "all">(() => {
    const saved = getStickyFilter(userKey, "agent-queue");
    if (saved === "all" || (STATUSES as string[]).includes(saved)) return saved as AgentWorkStatus | "all";
    return "all";
  });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const focus = params.get("focus");
    if (focus) setFocusId(focus);
  }, [search]);

  const chooseStatus = (status: AgentWorkStatus | "all") => {
    setStatusFilter(status);
    setStickyFilter(userKey, "agent-queue", status);
  };
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<AgentWorkType>("fix");
  const [priority, setPriority] = useState<AgentWorkPriority>("medium");
  const [affectedModule, setAffectedModule] = useState("Cursor Direct Requests");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [approvalRoute, setApprovalRoute] = useState<ApprovalRoute>("carmen");
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [owner, setOwner] = useState("");
  const [verificationSteps, setVerificationSteps] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(
    () => statusFilter === "all" ? agentWorkItems : agentWorkItems.filter((item) => item.status === statusFilter),
    [agentWorkItems, statusFilter],
  );

  useEffect(() => {
    if (!focusId) return;
    window.setTimeout(() => focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [focusId, filtered]);
  const approved = agentWorkItems.filter((item) => item.status === "approved-for-agent").length;
  const active = agentWorkItems.filter((item) => item.status === "in-progress" || item.status === "blocked").length;

  const submit = async () => {
    if (!title.trim() || !description.trim() || !desiredOutcome.trim()) {
      toast({ title: "Missing fields", description: "Title, description, and desired outcome are required." });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createAgentWork({
        title: title.trim(),
        description: description.trim(),
        requestType,
        priority,
        affectedModule,
        desiredOutcome: desiredOutcome.trim(),
        owner: owner.trim() || null,
        approvalRoute,
        risk,
        source: "CollabOS Cursor Direct Requests",
        verificationSteps: splitSteps(verificationSteps),
      });
      if (!created) {
        toast({ title: "Couldn’t create request", description: "Try again in a moment.", variant: "destructive" });
        return;
      }

      let uploaded = 0;
      for (const file of pendingFiles) {
        try {
          await uploadFileForItem(created.id, file);
          uploaded += 1;
        } catch {
          toast({
            title: "Request created, but a file failed",
            description: file.name,
            variant: "destructive",
          });
        }
      }

      setTitle("");
      setDescription("");
      setDesiredOutcome("");
      setOwner("");
      setVerificationSteps("");
      setPendingFiles([]);
      setShowForm(false);
      toast({
        title: "Cursor request created",
        description:
          uploaded > 0
            ? `Saved with ${uploaded} file${uploaded === 1 ? "" : "s"} for Carmen. It still needs your approval before Cursor starts.`
            : "Saved to the shared list. It still needs your approval before Cursor starts.",
      });
    } finally {
      setSubmitting(false);
      if (createFileRef.current) createFileRef.current.value = "";
    }
  };

  const update = (id: string, patch: Parameters<typeof updateAgentWork>[1]) => {
    void updateAgentWork(id, patch).then(() => {
      toast({ title: "Request updated", description: "The list now has the latest progress." });
    });
  };

  const addEvent = (id: string, action: string, note?: string) => {
    void addAgentWorkItemEvent(id, action, note).then(() => {
      toast({ title: "Note added", description: "Progress was saved to this request." });
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Cursor Direct Requests"
        subtitle="Work you've approved for Cursor to pick up, do, and report back on."
        icon={Bot}
        accent="violet"
        actions={
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600">
            <Plus className="h-4 w-4" /> New request
          </button>
        }
      />

      <AgentProtocol />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
          <p className="text-xs font-medium text-violet-600">Ready for Cursor</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{approved}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-xs font-medium text-amber-600">In progress or blocked</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{active}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total requests</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{agentWorkItems.length}</p>
        </div>
      </div>

      {showForm && (
        <SectionCard title="New Cursor Direct Request" icon={PlayCircle} accent="violet">
          <div className="grid gap-3 md:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" placeholder="Title" />
            <select value={affectedModule} onChange={(e) => setAffectedModule(e.target.value)} className="field-input">
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="field-input md:col-span-2" placeholder="What needs fixing or improving?" />
            <textarea value={desiredOutcome} onChange={(e) => setDesiredOutcome(e.target.value)} rows={2} className="field-input md:col-span-2" placeholder="Desired outcome Rose/Carmen should see after execution" />
            <select value={requestType} onChange={(e) => setRequestType(e.target.value as AgentWorkType)} className="field-input">
              {WORK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as AgentWorkPriority)} className="field-input">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={approvalRoute} onChange={(e) => setApprovalRoute(e.target.value as ApprovalRoute)} className="field-input">
              <option value="rose">Rose</option>
              <option value="carmen">Carmen</option>
              <option value="both">Rose + Carmen</option>
              <option value="none">No approval needed</option>
            </select>
            <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)} className="field-input">
              <option value="low">Low risk</option>
              <option value="medium">Medium risk</option>
              <option value="high">High risk</option>
              <option value="critical">Critical risk</option>
            </select>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="field-input" placeholder="Owner, optional" />
            <textarea value={verificationSteps} onChange={(e) => setVerificationSteps(e.target.value)} rows={2} className="field-input" placeholder="Verification steps, one per line" />
          </div>

          {canUpload && (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Attach files for Carmen</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Optional. PDFs, Word docs, zips, Markdown, HTML, spreadsheets, or images — max 25 MB each.
              </p>
              <input
                ref={createFileRef}
                type="file"
                accept={ACCEPT_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
                  if (tooBig) {
                    toast({ title: "File too large", description: `${tooBig.name} exceeds 25 MB.`, variant: "destructive" });
                    return;
                  }
                  setPendingFiles((prev) => [...prev, ...files]);
                  if (createFileRef.current) createFileRef.current.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => createFileRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                <Upload className="h-3.5 w-3.5" /> Add files
              </button>
              {pendingFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                      <span>{f.name} · {formatBytes(f.size)}</span>
                      <button
                        type="button"
                        className="font-semibold text-slate-400 hover:text-rose-600"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
            <button disabled={submitting} onClick={() => void submit()} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50">
              {submitting ? "Creating…" : "Create request"}
            </button>
          </div>
        </SectionCard>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...STATUSES] as const).map((status) => (
          <button key={status} onClick={() => chooseStatus(status)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${statusFilter === status ? "bg-violet-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {status === "all" ? "All" : humanLabel(HUMAN_AGENT_STATUS, status)}
          </button>
        ))}
        {statusFilter !== "all" ? <span className="text-[10px] text-slate-400">Filters remembered for you</span> : null}
      </div>

      <div className="space-y-3">
        {agentWorkLoading && <p className="py-10 text-center text-sm text-slate-400">Loading your Cursor request list…</p>}
        {!agentWorkLoading && filtered.length === 0 && (
          <EmptyState
            message={
              statusFilter === "all" || agentWorkItems.length === 0
                ? "Nothing in Cursor Direct Requests yet."
                : `Nothing here — ${agentWorkItems.length} request${agentWorkItems.length === 1 ? "" : "s"} waiting in All.`
            }
            hint="Log a new request or approve one that's waiting on you."
            action={
              statusFilter !== "all" && agentWorkItems.length > 0 ? (
                <button
                  onClick={() => chooseStatus("all")}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600"
                >
                  Show All ({agentWorkItems.length})
                </button>
              ) : undefined
            }
          />
        )}
        {!agentWorkLoading && filtered.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            canManage={canManage}
            canUpload={canUpload}
            onUpdate={update}
            onEvent={addEvent}
            focused={focusId === item.id}
            wrapRef={focusId === item.id ? focusRef : undefined}
          />
        ))}
      </div>
    </div>
  );
}
