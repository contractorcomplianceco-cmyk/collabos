import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Inbox, Filter, ShieldAlert, Lock, Archive, Brain, ClipboardCheck, ListTodo,
  Lightbulb, Hammer, BookOpen, Link2, Plus, Send, Plug, MessageSquare, History,
  Wand2, Sparkles, Gauge, AlertTriangle, Copy, GitMerge, Network, BookmarkPlus,
  HelpCircle, SearchCheck,
} from "lucide-react";
import { PageHeader, SectionCard, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  computeIntakeReadiness, detectIntakeFriction, generateBuildPrompt, detectIntakeDuplicates,
  canViewSensitive, canSubmit,
} from "@/lib/helpers";
import type {
  IntakeSource, IntakeDestination, IntakeSensitivity,
  IntakeDetectedType, IntakeStatus, IntakeDuplicateRisk, IntakeReviewOwner,
  IntegrationMode, ReadinessLevel, MemoryDestination, IntakeItem,
} from "@/types";

const SOURCE_LABEL: Record<IntakeSource, string> = {
  zoho_cliq: "Zoho Cliq (not live)",
  whatsapp: "WhatsApp (not live)",
  manual: "CollabOS note",
};
const SOURCE_TONE: Record<IntakeSource, "sky" | "emerald" | "slate"> = {
  zoho_cliq: "sky",
  whatsapp: "emerald",
  manual: "slate",
};

const TYPE_LABEL: Record<IntakeDetectedType, string> = {
  idea: "Idea",
  todo: "To-do",
  build_request: "Build request",
  decision_candidate: "Decision candidate",
  blocker: "Blocker",
  question: "Question",
  process_update: "Process update",
  crm_or_zoho_request: "CRM / Zoho request",
  automation_request: "Automation request",
  sensitive_private_item: "Sensitive / private",
  rose_carmen_mind_meld: "Rose/Carmen Mind Meld",
  company_brain_update_suggestion: "Company Brain suggestion",
  ignore_or_noise: "Noise",
};

const DEST_LABEL: Record<IntakeDestination, string> = {
  "mind-meld": "Rose & Carmen Mind Meld",
  "review-queue": "Review Queue",
  "command-center-task": "Cursor Direct Request",
  "idea-backlog": "Draft idea",
  "build-registry": "Suggest a build request",
  "requirements-registry": "Suggest requirements",
  "automation-registry": "Suggest an automation",
  "decision-log": "Suggest a decision",
  "company-brain-update": "Suggest a Company Brain update",
  "no-action": "No action",
};

const SENSITIVITY_LABEL: Record<IntakeSensitivity, string> = {
  normal: "Normal",
  private_leadership: "Private / Leadership",
  client_sensitive: "Client sensitive",
  hr_sensitive: "HR sensitive",
  financial_sensitive: "Financial sensitive",
  legal_sensitive: "Legal sensitive",
  unclear: "Unclear",
};
const SENSITIVITY_TONE: Record<IntakeSensitivity, "slate" | "rose" | "amber" | "violet" | "orange" | "sky"> = {
  normal: "slate",
  private_leadership: "rose",
  client_sensitive: "amber",
  hr_sensitive: "violet",
  financial_sensitive: "orange",
  legal_sensitive: "rose",
  unclear: "sky",
};

const STATUS_LABEL: Record<IntakeStatus, string> = {
  new: "New",
  needs_review: "Needs review",
  routed: "Routed",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};
const STATUS_TONE: Record<IntakeStatus, "sky" | "amber" | "violet" | "emerald" | "rose" | "slate"> = {
  new: "sky",
  needs_review: "amber",
  routed: "violet",
  approved: "emerald",
  rejected: "rose",
  archived: "slate",
};

const DUP_TONE: Record<IntakeDuplicateRisk, "slate" | "amber" | "rose"> = {
  none: "slate",
  possible: "amber",
  likely: "rose",
};

const GUARDRAILS = [
  "Incoming messages stay drafts until a person reviews them.",
  "Sensitive or private items stay with leadership.",
  "Automatic sorting is a suggestion — not an approved decision.",
  "Rose signs off on company direction, client-facing content, pricing, launches, and final calls.",
  "Carmen reviews systems, process, Zoho, AI, automations, and build plans.",
  "High-risk items may need both Rose and Carmen.",
];

const READINESS_LABEL: Record<ReadinessLevel, string> = {
  "not-ready": "Not ready",
  "needs-details": "Needs details",
  "review-ready": "Review ready",
  "build-ready": "Build ready",
};
const READINESS_TONE: Record<ReadinessLevel, "rose" | "amber" | "sky" | "emerald"> = {
  "not-ready": "rose",
  "needs-details": "amber",
  "review-ready": "sky",
  "build-ready": "emerald",
};
const READINESS_BAR: Record<ReadinessLevel, string> = {
  "not-ready": "bg-rose-400",
  "needs-details": "bg-amber-400",
  "review-ready": "bg-sky-400",
  "build-ready": "bg-emerald-400",
};

const MEMORY_DEST_LABEL: Record<MemoryDestination, string> = {
  "private-rose-carmen-memory": "Private Rose+Carmen memory",
  "company-brain-suggestion": "Company Brain suggestion",
  "project-note": "Project note",
  "future-idea": "Future idea",
  "decision-candidate": "Decision candidate",
  "knowledge-gap-report": "Knowledge gap report",
};

const ROUTE_ACTIONS: { dest: IntakeDestination; label: string; icon: React.ElementType }[] = [
  { dest: "mind-meld", label: "Send to Mind Meld", icon: Brain },
  { dest: "review-queue", label: "Send for review", icon: ClipboardCheck },
  { dest: "command-center-task", label: "Log a Cursor request", icon: ListTodo },
  { dest: "idea-backlog", label: "Save as draft idea", icon: Lightbulb },
  { dest: "build-registry", label: "Suggest a build request", icon: Hammer },
  { dest: "company-brain-update", label: "Suggest a Company Brain update", icon: BookOpen },
];

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-rose-300 focus:outline-none"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function IntegrationCard({ name, icon: Icon, mode, onModeChange, webhookPath, envVars, onTest, lastTest, canMutate }: {
  name: string;
  icon: React.ElementType;
  mode: IntegrationMode;
  onModeChange: (m: IntegrationMode) => void;
  webhookPath: string;
  envVars: string[];
  onTest: () => void;
  lastTest: string | null;
  canMutate: boolean;
}) {
  const connected = mode === "live";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500"><Icon className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{name}</p>
            <p className="text-xs text-slate-400">{connected ? "Connected" : mode === "test" ? "Demo / test mode" : "Integration not connected"}</p>
          </div>
        </div>
        <StatusChip label={mode} tone={mode === "live" ? "emerald" : mode === "test" ? "amber" : "slate"} />
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Integration mode</span>
          <div className="flex gap-1">
            {(["off", "test", "live"] as IntegrationMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                disabled={m === "live" || !canMutate}
                title={m === "live" ? "Live mode needs setup on the server first." : !canMutate ? "Your role can view only." : undefined}
                className={`rounded-lg px-2.5 py-1 font-medium capitalize transition ${
                  mode === m ? "bg-rose-500 text-white" : m === "live" || !canMutate ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Connection URL</span>
          <code className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{webhookPath}</code>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500">Setup keys</span>
          <div className="flex flex-col items-end gap-1">
            {envVars.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <code className="text-[11px] text-slate-600">{v}</code>
                <StatusChip label="not set up" tone="slate" />
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Last received test message</span>
          <span className="text-slate-600">{lastTest ?? "None yet"}</span>
        </div>
      </div>

      <button
        onClick={onTest}
        disabled={mode === "off" || !canMutate}
        className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
          mode === "off" || !canMutate ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-sky-100 text-sky-700 hover:bg-sky-200"
        }`}
      >
        <Send className="h-3.5 w-3.5" /> Send a test message
      </button>
      <p className="mt-2 text-[11px] text-slate-400">
        Test messages stay on this page for now. A live {name} connection needs setup before real messages arrive.
      </p>
    </div>
  );
}

export default function ExternalIntake() {
  const {
    intakeItems, intakeLoading, addIntakeItem, updateIntakeItem, routeIntakeItem, addMemoryCandidate,
    currentRole, settings, updateSettings, projects,
  } = useAppState();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<"queue" | "constellation" | "integrations">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [buildPrompt, setBuildPrompt] = useState<string | null>(null);
  const [memoryDest, setMemoryDest] = useState<MemoryDestination>("company-brain-suggestion");
  const [showMemoryPicker, setShowMemoryPicker] = useState(false);

  const [fSource, setFSource] = useState("all");
  const [fType, setFType] = useState("all");
  const [fDest, setFDest] = useState("all");
  const [fSens, setFSens] = useState("all");
  const [fOwner, setFOwner] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fDup, setFDup] = useState("all");
  const [fReadiness, setFReadiness] = useState("all");
  const [fFriction, setFFriction] = useState("all");

  const [formMessage, setFormMessage] = useState("");
  const [formFor, setFormFor] = useState<"Carmen" | "Rose" | "Rose and Carmen">("Rose and Carmen");

  const actor = currentRole === "Rose" ? "Rose Almeida" : currentRole === "Carmen" ? "Carmen Vega" : (user?.name ?? String(currentRole));
  const canSeeSensitive = canViewSensitive(currentRole);
  const canAct = canSubmit(currentRole);
  const isRestricted = (it: IntakeItem) => it.sensitivity !== "normal" && !canSeeSensitive;
  const internalNotes = useMemo(
    () =>
      intakeItems.filter(
        (it) =>
          it.source === "manual" ||
          (it.sourceChannel.toLowerCase().includes("rose") && it.sourceChannel.toLowerCase().includes("carmen")),
      ),
    [intakeItems],
  );

  const readinessById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeIntakeReadiness>>();
    intakeItems.forEach((it) => map.set(it.id, computeIntakeReadiness(it)));
    return map;
  }, [intakeItems]);

  const frictionById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof detectIntakeFriction>>();
    intakeItems.forEach((it) => map.set(it.id, detectIntakeFriction(it)));
    return map;
  }, [intakeItems]);

  const filtered = useMemo(
    () =>
      intakeItems.filter(
        (it) =>
          (fSource === "all" || it.source === fSource) &&
          (fType === "all" || it.detectedType === fType) &&
          (fDest === "all" || it.suggestedDestination === fDest) &&
          (fSens === "all" || it.sensitivity === fSens) &&
          (fOwner === "all" || it.reviewOwner === fOwner) &&
          (fStatus === "all" || it.status === fStatus) &&
          (fDup === "all" || it.duplicateRisk === fDup) &&
          (fReadiness === "all" || readinessById.get(it.id)?.level === fReadiness) &&
          (fFriction === "all" ||
            (fFriction === "has-friction"
              ? (frictionById.get(it.id)?.length ?? 0) > 0
              : (frictionById.get(it.id)?.length ?? 0) === 0)),
      ),
    [intakeItems, fSource, fType, fDest, fSens, fOwner, fStatus, fDup, fReadiness, fFriction, readinessById, frictionById],
  );

  const selected = intakeItems.find((it) => it.id === selectedId) ?? null;
  const selectedReadiness = selected ? readinessById.get(selected.id) ?? null : null;
  const selectedFriction = selected ? frictionById.get(selected.id) ?? [] : [];

  const constellationClusters = useMemo(() => {
    const clusters = new Map<string, IntakeItem[]>();
    intakeItems.forEach((it) => {
      const keys = it.relatedProjectNames.length > 0 ? it.relatedProjectNames : [`${TYPE_LABEL[it.detectedType]} (unlinked)`];
      keys.forEach((k) => {
        clusters.set(k, [...(clusters.get(k) ?? []), it]);
      });
    });
    return [...clusters.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [intakeItems]);

  const submitInternalNote = () => {
    if (!canAct) {
      toast({ title: "View-only access", description: "Your role can't add notes here." });
      return;
    }
    if (!formMessage.trim()) {
      toast({ title: "Write a note first", description: "Tell Rose or Carmen what they need to know." });
      return;
    }
    const handle =
      currentRole === "Rose" ? "@rose" : currentRole === "Carmen" ? "@carmen" : (user?.email ?? "@collabos");
    addIntakeItem({
      source: "manual",
      sourceChannel: "Rose ↔ Carmen note",
      senderName: actor,
      senderHandle: handle,
      senderRole: currentRole === "Rose" || currentRole === "Carmen" ? currentRole : "Admin",
      rawMessage: formMessage.trim(),
      reviewOwner: formFor,
    });
    setFormMessage("");
    toast({
      title: "Note shared",
      description: `Visible to ${formFor}. WhatsApp and Cliq stay off until you approve them.`,
    });
  };

  const route = (dest: IntakeDestination, ownerOverride?: IntakeReviewOwner) => {
    if (!canAct || !selected) return;
    routeIntakeItem(selected.id, dest, actor, ownerOverride);
    toast({ title: DEST_LABEL[dest], description: dest === "no-action" ? "Item archived." : "Draft created — nothing is approved automatically." });
  };

  const carmenfy = () => {
    if (!canAct || !selected) return;
    routeIntakeItem(selected.id, "review-queue", actor, "Carmen");
    toast({ title: "Sent to Carmen", description: "Draft sent to Review Queue for Carmen — systems perspective." });
  };

  const rosify = () => {
    if (!canAct || !selected) return;
    routeIntakeItem(selected.id, "review-queue", actor, "Rose");
    toast({ title: "Sent to Rose", description: "Draft sent to Review Queue for Rose — direction perspective." });
  };

  const checkDuplicates = () => {
    if (!canAct || !selected) return;
    const dup = detectIntakeDuplicates(
      selected.rawMessage,
      projects.map((p) => ({ name: p.name, keywords: p.tags })),
    );
    updateIntakeItem(
      selected.id,
      { duplicateRisk: dup.risk, relatedProjectNames: dup.relatedNames },
      actor,
      dup.risk === "none"
        ? "Duplicate check run — no overlapping work found."
        : `Duplicate check run — ${dup.risk} overlap with: ${dup.relatedNames.join(", ")}.`,
    );
    toast({
      title: "Duplicate check complete",
      description: dup.risk === "none" ? "No overlapping work found." : `${dup.risk === "likely" ? "Likely" : "Possible"} overlap: ${dup.relatedNames.join(", ")}`,
    });
  };

  const preserveMemory = (dest: MemoryDestination) => {
    if (!canAct || !selected) return;
    addMemoryCandidate({
      sourceIntakeId: selected.id,
      summary: selected.cleanedSummary,
      destination: dest,
      sensitive: selected.sensitivity !== "normal",
      createdBy: actor,
    });
    setShowMemoryPicker(false);
    toast({ title: "Note saved for review", description: `Suggested for ${MEMORY_DEST_LABEL[dest]} — waiting on sign-off, nothing saved yet.` });
  };

  const copyBuildPrompt = async () => {
    if (!buildPrompt) return;
    try {
      await navigator.clipboard.writeText(buildPrompt);
      toast({ title: "Copied", description: "Build prompt copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually." });
    }
  };

  const sendTest = (source: IntakeSource) => {
    if (!canAct) return;
    addIntakeItem({
      source,
      sourceChannel: source === "zoho_cliq" ? "#test-webhook" : "Test webhook",
      senderName: "Webhook Tester",
      senderHandle: source === "zoho_cliq" ? "@webhook-test" : "+1 (555) 000-0000",
      rawMessage: "Test webhook message: need to follow up on the QualifierConnect automation workflow in Zoho CRM.",
    });
    toast({ title: "Test message added", description: "A sample message was added to the queue." });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Incoming Messages"
        subtitle="Rose ↔ Carmen notes and handoffs inside CollabOS. WhatsApp and Zoho Cliq stay off until you approve them."
        icon={Inbox}
        accent="sky"
      />

      {intakeLoading ? (
        <p className="text-sm text-slate-500">Loading incoming messages…</p>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["queue", "constellation", "integrations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${tab === t ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {t === "queue" ? "Shared inbox" : t === "constellation" ? "How things connect" : "External connections"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip label={`${internalNotes.length} CollabOS note${internalNotes.length === 1 ? "" : "s"}`} tone="sky" />
          <StatusChip label="WhatsApp / Cliq not live" tone="amber" />
          {canAct && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
            >
              <Plus className="h-3.5 w-3.5" /> {showForm ? "Hide compose" : "Leave a note"}
            </button>
          )}
        </div>
      </div>

      <SectionCard title="Privacy & governance guardrails" icon={ShieldAlert} accent="rose">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {GUARDRAILS.map((g) => (
            <li key={g} className="flex items-start gap-2 text-xs text-slate-600">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" /> {g}
            </li>
          ))}
        </ul>
      </SectionCard>

      {showForm && canAct && (
        <SectionCard title="Leave a note for Rose or Carmen" icon={Send} accent="sky">
          <p className="mb-3 text-xs text-slate-500">
            Shared inbox for handoffs — no WhatsApp, Cliq, or email required. For reusable reply templates, use{" "}
            <Link href="/prompt-library" className="font-semibold text-sky-600 hover:underline">Prompt Library</Link>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              From
              <input value={actor} readOnly className="field-input mt-1 bg-slate-50" />
            </label>
            <label className="text-xs text-slate-500">
              For
              <select value={formFor} onChange={(e) => setFormFor(e.target.value as typeof formFor)} className="field-input mt-1">
                <option value="Rose and Carmen">Both Rose and Carmen</option>
                <option value="Carmen">Carmen</option>
                <option value="Rose">Rose</option>
              </select>
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Note
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={4}
                placeholder="What they need to know, decide, or pick up next…"
                className="field-input mt-1"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
            <button onClick={submitInternalNote} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-600">
              <Send className="h-3.5 w-3.5" /> Share note
            </button>
          </div>
        </SectionCard>
      )}

      {tab === "integrations" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <IntegrationCard
            name="Zoho Cliq"
            icon={MessageSquare}
            mode={settings.zohoCliqMode}
            onModeChange={(m) => updateSettings({ zohoCliqMode: m })}
            webhookPath="/api/intake/zoho-cliq"
            envVars={["ZOHO_CLIQ_WEBHOOK_SECRET", "MESSAGE_INTAKE_ENABLED"]}
            onTest={() => sendTest("zoho_cliq")}
            lastTest={settings.lastTestMessageAt}
            canMutate={canAct}
          />
          <IntegrationCard
            name="WhatsApp"
            icon={Plug}
            mode={settings.whatsappMode}
            onModeChange={(m) => updateSettings({ whatsappMode: m })}
            webhookPath="/api/intake/whatsapp/webhook"
            envVars={["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"]}
            onTest={() => sendTest("whatsapp")}
            lastTest={settings.lastTestMessageAt}
            canMutate={canAct}
          />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 lg:col-span-2">
            Zoho Cliq and WhatsApp are not live. Use CollabOS notes on the Shared inbox tab for Rose ↔ Carmen handoffs. Leave external connections off until you approve turning them on.
          </div>
        </div>
      ) : tab === "constellation" ? (
        <div className="space-y-4">
          <SectionCard title="Collab Constellation" icon={Network} accent="sky">
            <p className="text-xs text-slate-500">
              Intake items clustered by the existing work they touch. Bigger clusters mean more conversations orbiting the same thing — a signal to align before building.
            </p>
          </SectionCard>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {constellationClusters.map(([cluster, items]) => (
              <div key={cluster} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{cluster}</p>
                  <StatusChip label={`${items.length} item${items.length === 1 ? "" : "s"}`} tone={items.length >= 3 ? "rose" : items.length === 2 ? "amber" : "slate"} />
                </div>
                <ul className="mt-3 space-y-2">
                  {items.map((it) => {
                    const r = readinessById.get(it.id);
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => { setTab("queue"); setSelectedId(it.id); setNoteDraft(it.reviewerNotes); setBuildPrompt(null); setShowMemoryPicker(false); }}
                          className="w-full rounded-xl bg-slate-50 p-2.5 text-left transition hover:bg-slate-100"
                        >
                          <p className="text-xs font-medium text-slate-700">
                            {isRestricted(it) ? (
                              <span className="inline-flex items-center gap-1.5 text-rose-600"><Lock className="h-3 w-3" /> Restricted — leadership review only</span>
                            ) : (
                              it.cleanedSummary
                            )}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusChip label={TYPE_LABEL[it.detectedType]} tone="sky" />
                            {r && <StatusChip label={READINESS_LABEL[r.level]} tone={READINESS_TONE[r.level]} />}
                            {it.sensitivity !== "normal" && <StatusChip label="Sensitive" tone="rose" />}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {items.length >= 2 && (
                  <p className="mt-2.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
                    Multiple items orbit {cluster} — consider linking or merging before creating new work.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Filter className="h-4 w-4 text-slate-400" />
            <FilterSelect label="Source" value={fSource} onChange={setFSource} options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Type" value={fType} onChange={setFType} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Destination" value={fDest} onChange={setFDest} options={Object.entries(DEST_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Sensitivity" value={fSens} onChange={setFSens} options={Object.entries(SENSITIVITY_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Owner" value={fOwner} onChange={setFOwner} options={(["Rose", "Carmen", "Rose and Carmen", "Assigned team member", "Unassigned"] as IntakeReviewOwner[]).map((v) => ({ value: v, label: v }))} />
            <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Duplicate risk" value={fDup} onChange={setFDup} options={[{ value: "none", label: "None" }, { value: "possible", label: "Possible" }, { value: "likely", label: "Likely" }]} />
            <FilterSelect label="Readiness" value={fReadiness} onChange={setFReadiness} options={Object.entries(READINESS_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Friction" value={fFriction} onChange={setFFriction} options={[{ value: "has-friction", label: "Has friction" }, { value: "no-friction", label: "No friction" }]} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <div className="space-y-3">
              {filtered.length === 0 && (
                <EmptyState
                  message={
                    intakeItems.length === 0
                      ? "No notes yet — leave one above for Rose or Carmen."
                      : `Nothing here — ${intakeItems.length} message${intakeItems.length === 1 ? "" : "s"} waiting in All.`
                  }
                  hint={
                    intakeItems.length === 0
                      ? "Need a reusable reply or handoff template? Open Prompt Library. WhatsApp and Cliq are not connected yet."
                      : "Clear filters to see everything, or leave a new CollabOS note."
                  }
                  action={
                    intakeItems.length === 0 ? (
                      <Link href="/prompt-library" className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">
                        Open Prompt Library
                      </Link>
                    ) : (
                      <button
                        onClick={() => {
                          setFSource("all");
                          setFType("all");
                          setFDest("all");
                          setFSens("all");
                          setFOwner("all");
                          setFStatus("all");
                          setFDup("all");
                          setFReadiness("all");
                          setFFriction("all");
                        }}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                      >
                        Clear filters ({intakeItems.length})
                      </button>
                    )
                  }
                />
              )}
              {filtered.map((it) => {
                const isSensitive = it.sensitivity !== "normal";
                const itemReadiness = readinessById.get(it.id);
                const itemFriction = frictionById.get(it.id) ?? [];
                return (
                  <button
                    key={it.id}
                    onClick={() => { setSelectedId(it.id); setNoteDraft(it.reviewerNotes); setBuildPrompt(null); setShowMemoryPicker(false); }}
                    className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                      selectedId === it.id ? "border-rose-300 bg-rose-50/40 ring-1 ring-rose-200" : isSensitive ? "border-rose-100 bg-white hover:border-rose-200" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={SOURCE_LABEL[it.source]} tone={SOURCE_TONE[it.source]} />
                      <StatusChip label={STATUS_LABEL[it.status]} tone={STATUS_TONE[it.status]} />
                      {isSensitive && <StatusChip label={SENSITIVITY_LABEL[it.sensitivity]} tone={SENSITIVITY_TONE[it.sensitivity]} />}
                      {it.duplicateRisk !== "none" && <StatusChip label={`${it.duplicateRisk === "likely" ? "Likely" : "Possible"} duplicate`} tone={DUP_TONE[it.duplicateRisk]} />}
                      {itemReadiness && <StatusChip label={READINESS_LABEL[itemReadiness.level]} tone={READINESS_TONE[itemReadiness.level]} />}
                      {itemFriction.length > 0 && <StatusChip label={`${itemFriction.length} friction`} tone="amber" />}
                      <span className="ml-auto text-[11px] text-slate-400">{it.receivedAt}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {isRestricted(it) ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-600"><Lock className="h-3.5 w-3.5" /> Restricted — leadership review only</span>
                      ) : (
                        it.cleanedSummary
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      {!isRestricted(it) && <span><span className="text-slate-400">From</span> {it.senderName} · {it.sourceChannel}</span>}
                      <span><span className="text-slate-400">Type</span> {TYPE_LABEL[it.detectedType]}</span>
                      <span><span className="text-slate-400">Suggested</span> {DEST_LABEL[it.suggestedDestination]}</span>
                      <span><span className="text-slate-400">Reviewer</span> {it.reviewOwner}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              {!selected ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
                  Select a message to review details, sorting, and where to send it next.
                </div>
              ) : (
                <div className="sticky top-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={SOURCE_LABEL[selected.source]} tone={SOURCE_TONE[selected.source]} />
                    <StatusChip label={STATUS_LABEL[selected.status]} tone={STATUS_TONE[selected.status]} />
                    <StatusChip label={SENSITIVITY_LABEL[selected.sensitivity]} tone={SENSITIVITY_TONE[selected.sensitivity]} />
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original message</p>
                    {isRestricted(selected) ? (
                      <div className="mt-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-100">
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-rose-500"><Lock className="h-3 w-3" /> Restricted — leadership review only</p>
                        <p className="mt-1.5 text-xs text-rose-800/80">This item is marked {SENSITIVITY_LABEL[selected.sensitivity]}. Only Rose, Carmen, or an Admin can view its content.</p>
                      </div>
                    ) : (
                      <>
                        <div className={`mt-1 rounded-xl p-3 text-sm ${selected.sensitivity !== "normal" ? "bg-rose-50 text-rose-900 ring-1 ring-rose-100" : "bg-slate-50 text-slate-700"}`}>
                          {selected.sensitivity !== "normal" && (
                            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-500"><Lock className="h-3 w-3" /> Sensitive — do not share broadly</p>
                          )}
                          {selected.rawMessage}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">From {selected.senderName} ({selected.senderHandle}) · {selected.sourceChannel} · {selected.receivedAt}</p>
                      </>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rule-based classification</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Type</span><span className="font-medium text-slate-700">{TYPE_LABEL[selected.detectedType]}</span></div>
                      <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Suggested destination</span><span className="font-medium text-slate-700">{DEST_LABEL[selected.suggestedDestination]}</span></div>
                      <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Suggested reviewer</span><span className="font-medium text-slate-700">{selected.reviewOwner}</span></div>
                      <div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Duplicate risk</span><span className="font-medium capitalize text-slate-700">{selected.duplicateRisk}</span></div>
                    </div>
                    <p className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-800">{selected.nextStep}</p>
                    <p className="mt-1.5 text-[11px] text-slate-400">Classifications are recommendations only — a human decides the final routing.</p>
                  </div>

                  <div className="rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-500"><HelpCircle className="h-3.5 w-3.5" /> What is this?</p>
                    <p className="mt-1.5 text-xs text-slate-700">{selected.classificationReason}</p>
                  </div>

                  {selectedReadiness && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Gauge className="h-3.5 w-3.5" /> Decision readiness</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${READINESS_BAR[selectedReadiness.level]}`} style={{ width: `${selectedReadiness.overall}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{selectedReadiness.overall}%</span>
                        <StatusChip label={READINESS_LABEL[selectedReadiness.level]} tone={READINESS_TONE[selectedReadiness.level]} />
                      </div>
                      <p className="mt-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{selectedReadiness.recommendedNextStep}</p>
                      {selectedReadiness.missing.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {selectedReadiness.missing.map((m) => (
                            <li key={m} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {m}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {selectedFriction.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> Friction detector</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {selectedFriction.map((f) => (
                          <li key={f.label} className={`rounded-lg p-2 text-[11px] ${f.severity === "high" ? "bg-rose-50 text-rose-800" : f.severity === "medium" ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-600"}`}>
                            <span className="font-semibold">{f.label}:</span> {f.detail}
                            <span className="mt-0.5 block text-[10px] opacity-80">Fix: {f.suggestedFix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.relatedProjectNames.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Possible related work</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {selected.relatedProjectNames.map((p) => (
                          <StatusChip key={p} label={p} tone="violet" />
                        ))}
                      </div>
                      {selected.duplicateRisk !== "none" && (
                        <p className="mt-1.5 text-[11px] text-amber-700">Review the linked work before creating anything new.</p>
                      )}
                    </div>
                  )}

                  {selected.finalActionTaken && (
                    <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">Final action: {selected.finalActionTaken}</p>
                  )}

                  {!canAct && (
                    <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
                      Your role has view-only access — routing and review actions are limited to team members and leadership.
                    </p>
                  )}

                  {canAct && selected.status !== "routed" && selected.status !== "archived" && selected.duplicateRisk !== "none" && (
                    <div className="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600"><GitMerge className="h-3.5 w-3.5" /> Merge suggestion</p>
                      <p className="mt-1 text-[11px] text-amber-800">
                        This overlaps with {selected.relatedProjectNames.join(", ") || "existing work"}. Nothing is merged automatically — pick how to handle it:
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            updateIntakeItem(selected.id, { status: "needs_review" }, actor, `Linked to existing work (${selected.relatedProjectNames.join(", ")}) — kept for review.`);
                            toast({ title: "Linked", description: "Item linked to the existing work for review." });
                          }}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                        >
                          Link to existing work
                        </button>
                        <button
                          onClick={() => route("review-queue")}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                        >
                          Send merge to review
                        </button>
                        <button
                          onClick={() => {
                            updateIntakeItem(selected.id, { duplicateRisk: "none" }, actor, "Reviewed duplicate suggestion — kept as separate work.");
                            toast({ title: "Kept separate", description: "Marked as distinct from existing work." });
                          }}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                        >
                          Keep separate
                        </button>
                        <button
                          onClick={() => route("no-action")}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                        >
                          Archive as duplicate
                        </button>
                      </div>
                    </div>
                  )}

                  {canAct && selected.status !== "routed" && selected.status !== "archived" && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Wand2 className="h-3.5 w-3.5" /> Magic actions</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button
                          onClick={carmenfy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-2 text-left text-[11px] font-medium text-sky-700 transition hover:bg-sky-100"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" /> Send to Carmen — systems view
                        </button>
                        <button
                          onClick={rosify}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-2 text-left text-[11px] font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" /> Send to Rose — direction view
                        </button>
                        <button
                          onClick={checkDuplicates}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-2 text-left text-[11px] font-medium text-violet-700 transition hover:bg-violet-100"
                        >
                          <SearchCheck className="h-3.5 w-3.5 shrink-0" /> Check for Duplicates
                        </button>
                        <button
                          onClick={() => setShowMemoryPicker((v) => !v)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-left text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5 shrink-0" /> Do Not Forget This
                        </button>
                      </div>
                      {showMemoryPicker && (
                        <div className="mt-2 rounded-xl bg-emerald-50/60 p-3 ring-1 ring-emerald-100">
                          <p className="text-[11px] font-semibold text-emerald-700">Where should this memory live? (proposed only — approval required)</p>
                          <div className="mt-1.5 flex gap-1.5">
                            <select
                              value={memoryDest}
                              onChange={(e) => setMemoryDest(e.target.value as MemoryDestination)}
                              className="field-input flex-1 text-xs"
                            >
                              {Object.entries(MEMORY_DEST_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => preserveMemory(memoryDest)}
                              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600"
                            >
                              Preserve
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {canAct && !isRestricted(selected) && (selected.detectedType === "build_request" || selected.detectedType === "automation_request" || selected.detectedType === "idea") && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Hammer className="h-3.5 w-3.5" /> Instant build prompt</p>
                      {buildPrompt === null ? (
                        <button
                          onClick={() => setBuildPrompt(generateBuildPrompt(selected))}
                          className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <Wand2 className="h-3.5 w-3.5" /> Generate build prompt (draft)
                        </button>
                      ) : (
                        <div className="mt-1.5 space-y-1.5">
                          <textarea
                            value={buildPrompt}
                            onChange={(e) => setBuildPrompt(e.target.value)}
                            rows={10}
                            className="field-input font-mono text-[11px] leading-relaxed"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={copyBuildPrompt}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </button>
                            <button
                              onClick={() => setBuildPrompt(null)}
                              className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"
                            >
                              Discard
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">A human edits and approves this prompt — it is never sent anywhere automatically.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {canAct && selected.status !== "routed" && selected.status !== "archived" && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Route this item</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {ROUTE_ACTIONS.map((a) => (
                          <button
                            key={a.dest}
                            onClick={() => route(a.dest)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-slate-200"
                          >
                            <a.icon className="h-3.5 w-3.5 shrink-0 text-slate-500" /> {a.label}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            updateIntakeItem(selected.id, { sensitivity: "private_leadership", reviewOwner: "Rose and Carmen" }, actor, "Marked sensitive / private — restricted to leadership review.");
                            toast({ title: "Marked sensitive", description: "Item is now restricted to leadership review." });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-2 text-left text-[11px] font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          <Lock className="h-3.5 w-3.5 shrink-0" /> Mark Sensitive / Private
                        </button>
                        <button
                          onClick={() => {
                            updateIntakeItem(selected.id, { duplicateRisk: "likely", status: "needs_review" }, actor, "Marked as duplicate — linked to existing work for review.");
                            toast({ title: "Marked duplicate", description: "Linked to existing work — review before creating new work." });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-left text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                        >
                          <Link2 className="h-3.5 w-3.5 shrink-0" /> Mark Duplicate / Link
                        </button>
                        <button
                          onClick={() => route("no-action")}
                          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-100"
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive / No Action
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">All routing creates drafts or review items — nothing is auto-approved.</p>
                    </div>
                  )}

                  {canAct && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reviewer notes</p>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={2}
                        placeholder="Add context for the next reviewer..."
                        className="field-input mt-1.5"
                      />
                      <button
                        onClick={() => {
                          updateIntakeItem(selected.id, { reviewerNotes: noteDraft }, actor, "Updated reviewer notes.");
                          toast({ title: "Notes saved" });
                        }}
                        className="mt-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                      >
                        Save notes
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><History className="h-3.5 w-3.5" /> Audit trail</p>
                    <ul className="mt-1.5 space-y-1 border-l-2 border-slate-100 pl-3">
                      {selected.auditLog.map((a) => (
                        <li key={a.id} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{a.actor}</span> — {a.action} <span className="text-slate-300">· {a.timestamp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
