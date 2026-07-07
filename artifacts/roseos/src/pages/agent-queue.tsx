import React, { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  MessageSquarePlus,
  PlayCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { ApprovalRouteBadge, EmptyState, PageHeader, RiskBadge, SectionCard, StatusChip } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { AgentWorkItem, AgentWorkPriority, AgentWorkStatus, AgentWorkType, ApprovalRoute, RiskLevel } from "@/types";

const WORK_TYPES: AgentWorkType[] = ["bug", "fix", "improvement", "ops", "question", "integration-prep"];
const PRIORITIES: AgentWorkPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: AgentWorkStatus[] = ["new", "triaged", "approved-for-agent", "in-progress", "blocked", "ready-for-review", "done", "rejected"];
const MODULES = ["Cursor Direct Requests", "External Intake", "Review Queue", "Mind Meld", "Market Pulse", "Settings", "Integrations", "Operations", "Other"];

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

function AgentProtocol() {
  return (
    <SectionCard title="Agent Execution Protocol" icon={ShieldCheck} accent="violet">
      <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div className="rounded-xl bg-violet-50/60 p-3">
          <p className="font-semibold text-violet-700">1. Human request</p>
          <p className="mt-1 text-xs">Rose, Carmen, or an approved contributor creates a specific work item with a desired outcome.</p>
        </div>
        <div className="rounded-xl bg-sky-50/60 p-3">
          <p className="font-semibold text-sky-700">2. Approval gate</p>
          <p className="mt-1 text-xs">The agent only works items marked approved for agent or explicitly approved in chat.</p>
        </div>
        <div className="rounded-xl bg-emerald-50/60 p-3">
          <p className="font-semibold text-emerald-700">3. Evidence loop</p>
          <p className="mt-1 text-xs">Execution notes, checks, deployment status, branch, commit, or MR links are written back here.</p>
        </div>
      </div>
    </SectionCard>
  );
}

function WorkItemCard({
  item,
  canManage,
  onUpdate,
  onEvent,
}: {
  item: AgentWorkItem;
  canManage: boolean;
  onUpdate: (id: string, patch: Parameters<ReturnType<typeof useAppState>["updateAgentWork"]>[1]) => void;
  onEvent: (id: string, action: string, note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={item.status} tone={STATUS_TONE[item.status]} />
            <StatusChip label={item.priority} tone={PRIORITY_TONE[item.priority]} />
            <StatusChip label={item.requestType} tone="sky" />
            <RiskBadge value={item.risk} />
            <ApprovalRouteBadge value={item.approvalRoute} />
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
          <SectionCard title="Execution Fields" icon={GitBranch} accent="sky" className="shadow-none">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-500">
                  Status
                  <select disabled={!canManage} value={status} onChange={(e) => setStatus(e.target.value as AgentWorkStatus)} className="field-input mt-1">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
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
                <textarea disabled={!canManage} value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} rows={3} className="field-input mt-1" placeholder="What the agent did, found, or needs." />
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
                <textarea disabled={!canManage} value={finalOutcome} onChange={(e) => setFinalOutcome(e.target.value)} rows={2} className="field-input mt-1" placeholder="What Rose should review." />
              </label>
              {canManage && (
                <button onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save execution update
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
        </div>
      )}
    </div>
  );
}

export default function AgentQueue() {
  const { agentWorkItems, agentWorkLoading, createAgentWork, updateAgentWork, addAgentWorkItemEvent } = useAppState();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("agent_work_manage");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AgentWorkStatus | "all">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<AgentWorkType>("fix");
  const [priority, setPriority] = useState<AgentWorkPriority>("medium");
  const [affectedModule, setAffectedModule] = useState("Cursor Direct Requests");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [approvalRoute, setApprovalRoute] = useState<ApprovalRoute>("carmen");
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [owner, setOwner] = useState("");
  const [verificationSteps, setVerificationSteps] = useState("");

  const filtered = useMemo(
    () => statusFilter === "all" ? agentWorkItems : agentWorkItems.filter((item) => item.status === statusFilter),
    [agentWorkItems, statusFilter],
  );
  const approved = agentWorkItems.filter((item) => item.status === "approved-for-agent").length;
  const active = agentWorkItems.filter((item) => item.status === "in-progress" || item.status === "blocked").length;

  const submit = async () => {
    if (!title.trim() || !description.trim() || !desiredOutcome.trim()) {
      toast({ title: "Missing fields", description: "Title, description, and desired outcome are required." });
      return;
    }
    await createAgentWork({
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
    setTitle("");
    setDescription("");
    setDesiredOutcome("");
    setOwner("");
    setVerificationSteps("");
    setShowForm(false);
    toast({ title: "Cursor direct request created", description: "Saved to the shared queue. It still needs approval before Cursor execution." });
  };

  const update = (id: string, patch: Parameters<typeof updateAgentWork>[1]) => {
    void updateAgentWork(id, patch).then(() => {
      toast({ title: "Cursor request updated", description: "The shared queue has the latest execution state." });
    });
  };

  const addEvent = (id: string, action: string, note?: string) => {
    void addAgentWorkItemEvent(id, action, note).then(() => {
      toast({ title: "Event added", description: "Execution evidence was appended to the work item." });
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Cursor Direct Requests"
        subtitle="Human-approved work requests for Cursor to pick up, execute, and report back."
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
          <p className="text-xs font-medium text-violet-600">Ready for agent</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{approved}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-xs font-medium text-amber-600">Active / blocked</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{active}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total work items</p>
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
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
            <button onClick={submit} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600">Create request</button>
          </div>
        </SectionCard>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((status) => (
          <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${statusFilter === status ? "bg-violet-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {status.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {agentWorkLoading && <p className="py-10 text-center text-sm text-slate-400">Loading shared Cursor request queue...</p>}
        {!agentWorkLoading && filtered.length === 0 && <EmptyState message="No work items in this state." hint="Create a request or approve an existing item for agent execution." />}
        {!agentWorkLoading && filtered.map((item) => (
          <WorkItemCard key={item.id} item={item} canManage={canManage} onUpdate={update} onEvent={addEvent} />
        ))}
      </div>
    </div>
  );
}
