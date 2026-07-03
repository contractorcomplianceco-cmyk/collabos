import React, { useMemo, useState } from "react";
import {
  Inbox, Filter, ShieldAlert, Lock, Archive, Brain, ClipboardCheck, ListTodo,
  Lightbulb, Hammer, BookOpen, Link2, Plus, Send, Plug, MessageSquare, History,
} from "lucide-react";
import { PageHeader, SectionCard, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";
import type {
  IntakeSource, IntakeDestination, IntakeSensitivity,
  IntakeDetectedType, IntakeStatus, IntakeDuplicateRisk, IntakeReviewOwner,
  IntegrationMode,
} from "@/types";

const SOURCE_LABEL: Record<IntakeSource, string> = {
  zoho_cliq: "Zoho Cliq",
  whatsapp: "WhatsApp",
  manual: "Manual",
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
  rose_carmen_mind_meld: "Rose/Carmen Mind Meld",
  company_brain_update_suggestion: "Company Brain suggestion",
  ignore_or_noise: "Noise",
};

const DEST_LABEL: Record<IntakeDestination, string> = {
  "mind-meld": "Rose/Carmen Mind Meld",
  "review-queue": "CollabOS Review Queue",
  "command-center-task": "Command Center Task",
  "idea-backlog": "Idea Backlog",
  "build-registry": "Build Registry Suggestion",
  "requirements-registry": "Requirements Registry Suggestion",
  "automation-registry": "Automation Registry Suggestion",
  "decision-log": "Decision Log Suggestion",
  "company-brain-update": "Company Brain Update Suggestion",
  "no-action": "No Action",
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
  "External messages are intake drafts until reviewed by a human.",
  "Sensitive or private items must not be shared broadly.",
  "Rule-based classifications are recommendations, not approved company decisions.",
  "Rose approves company direction, client-facing content, pricing, launch decisions, and final decisions.",
  "Carmen reviews systems, process, Zoho, AI, automation, and build architecture.",
  "High-risk items may require both Rose and Carmen.",
];

const ROUTE_ACTIONS: { dest: IntakeDestination; label: string; icon: React.ElementType }[] = [
  { dest: "mind-meld", label: "Send to Rose/Carmen Mind Meld", icon: Brain },
  { dest: "review-queue", label: "Send to Review Queue", icon: ClipboardCheck },
  { dest: "command-center-task", label: "Create Draft Task", icon: ListTodo },
  { dest: "idea-backlog", label: "Create Draft Idea", icon: Lightbulb },
  { dest: "build-registry", label: "Create Build Request Draft", icon: Hammer },
  { dest: "company-brain-update", label: "Propose Company Brain Update", icon: BookOpen },
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

function IntegrationCard({ name, icon: Icon, mode, onModeChange, webhookPath, envVars, onTest, lastTest }: {
  name: string;
  icon: React.ElementType;
  mode: IntegrationMode;
  onModeChange: (m: IntegrationMode) => void;
  webhookPath: string;
  envVars: string[];
  onTest: () => void;
  lastTest: string | null;
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
                disabled={m === "live"}
                title={m === "live" ? "Live mode requires configured environment variables and server endpoints." : undefined}
                className={`rounded-lg px-2.5 py-1 font-medium capitalize transition ${
                  mode === m ? "bg-rose-500 text-white" : m === "live" ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Webhook URL</span>
          <code className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{webhookPath}</code>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-slate-500">Environment variables</span>
          <div className="flex flex-col items-end gap-1">
            {envVars.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <code className="text-[11px] text-slate-600">{v}</code>
                <StatusChip label="not set" tone="slate" />
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
        disabled={mode === "off"}
        className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
          mode === "off" ? "cursor-not-allowed bg-slate-50 text-slate-300" : "bg-sky-100 text-sky-700 hover:bg-sky-200"
        }`}
      >
        <Send className="h-3.5 w-3.5" /> Send test webhook message
      </button>
      <p className="mt-2 text-[11px] text-slate-400">
        Test messages are simulated locally. No live {name} connection exists until environment variables and server endpoints are configured.
      </p>
    </div>
  );
}

export default function ExternalIntake() {
  const { intakeItems, addIntakeItem, updateIntakeItem, routeIntakeItem, currentRole, settings, updateSettings } = useAppState();
  const { toast } = useToast();

  const [tab, setTab] = useState<"queue" | "integrations">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const [fSource, setFSource] = useState("all");
  const [fType, setFType] = useState("all");
  const [fDest, setFDest] = useState("all");
  const [fSens, setFSens] = useState("all");
  const [fOwner, setFOwner] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fDup, setFDup] = useState("all");

  const [formSource, setFormSource] = useState<IntakeSource>("manual");
  const [formSender, setFormSender] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const actor = currentRole === "Rose" ? "Rose Almeida" : currentRole === "Carmen" ? "Carmen Vega" : String(currentRole);

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
          (fDup === "all" || it.duplicateRisk === fDup),
      ),
    [intakeItems, fSource, fType, fDest, fSens, fOwner, fStatus, fDup],
  );

  const selected = intakeItems.find((it) => it.id === selectedId) ?? null;

  const submitManual = () => {
    if (!formMessage.trim() || !formSender.trim()) {
      toast({ title: "Missing fields", description: "Sender name and message are required." });
      return;
    }
    addIntakeItem({
      source: formSource,
      sourceChannel: formChannel.trim() || (formSource === "manual" ? "Manual test entry" : "Test channel"),
      senderName: formSender.trim(),
      senderHandle: formHandle.trim() || "test-sender",
      rawMessage: formMessage.trim(),
    });
    setFormMessage("");
    setFormSender("");
    setFormHandle("");
    setFormChannel("");
    setShowForm(false);
    toast({ title: "Sample message captured", description: "Classified and added to the intake queue (test mode)." });
  };

  const route = (dest: IntakeDestination) => {
    if (!selected) return;
    routeIntakeItem(selected.id, dest, actor);
    toast({ title: DEST_LABEL[dest], description: dest === "no-action" ? "Item archived." : "Draft created — nothing is approved automatically." });
  };

  const sendTest = (source: IntakeSource) => {
    addIntakeItem({
      source,
      sourceChannel: source === "zoho_cliq" ? "#test-webhook" : "Test webhook",
      senderName: "Webhook Tester",
      senderHandle: source === "zoho_cliq" ? "@webhook-test" : "+1 (555) 000-0000",
      rawMessage: "Test webhook message: need to follow up on the QualifierConnect automation workflow in Zoho CRM.",
    });
    toast({ title: "Test webhook simulated", description: "A sample message was added to the intake queue." });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="External Intake"
        subtitle="Messages from Zoho Cliq, WhatsApp, and manual test entry — classified and routed for human review."
        icon={Inbox}
        accent="sky"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["queue", "integrations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${tab === t ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {t === "queue" ? "Intake Queue" : "Integration Settings"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <StatusChip label="Demo / test mode — no live integrations" tone="amber" />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
          >
            <Plus className="h-3.5 w-3.5" /> Add sample message
          </button>
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

      {showForm && (
        <SectionCard title="Manual sample intake (test mode)" icon={Plus} accent="sky">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Source
              <select value={formSource} onChange={(e) => setFormSource(e.target.value as IntakeSource)} className="field-input mt-1">
                <option value="manual">Manual test entry</option>
                <option value="zoho_cliq">Zoho Cliq (simulated)</option>
                <option value="whatsapp">WhatsApp (simulated)</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Channel
              <input value={formChannel} onChange={(e) => setFormChannel(e.target.value)} placeholder="#channel or chat name" className="field-input mt-1" />
            </label>
            <label className="text-xs text-slate-500">
              Sender name
              <input value={formSender} onChange={(e) => setFormSender(e.target.value)} placeholder="Who sent it" className="field-input mt-1" />
            </label>
            <label className="text-xs text-slate-500">
              Sender handle
              <input value={formHandle} onChange={(e) => setFormHandle(e.target.value)} placeholder="@handle or phone" className="field-input mt-1" />
            </label>
            <label className="text-xs text-slate-500 sm:col-span-2">
              Message
              <textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} rows={3} placeholder="Paste or type the message text — it will be classified automatically." className="field-input mt-1" />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
            <button onClick={submitManual} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-600">
              <Send className="h-3.5 w-3.5" /> Capture & classify
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
          />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 lg:col-span-2">
            This app currently runs frontend-only. Webhook URLs above are placeholders for a future backend — no live Zoho Cliq or WhatsApp
            integration exists. All intake here is simulated test data.
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
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
            <div className="space-y-3">
              {filtered.length === 0 && <EmptyState message="No intake items match these filters." />}
              {filtered.map((it) => {
                const isSensitive = it.sensitivity !== "normal";
                return (
                  <button
                    key={it.id}
                    onClick={() => { setSelectedId(it.id); setNoteDraft(it.reviewerNotes); }}
                    className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
                      selectedId === it.id ? "border-rose-300 bg-rose-50/40 ring-1 ring-rose-200" : isSensitive ? "border-rose-100 bg-white hover:border-rose-200" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={SOURCE_LABEL[it.source]} tone={SOURCE_TONE[it.source]} />
                      <StatusChip label={STATUS_LABEL[it.status]} tone={STATUS_TONE[it.status]} />
                      {isSensitive && <StatusChip label={SENSITIVITY_LABEL[it.sensitivity]} tone={SENSITIVITY_TONE[it.sensitivity]} />}
                      {it.duplicateRisk !== "none" && <StatusChip label={`${it.duplicateRisk === "likely" ? "Likely" : "Possible"} duplicate`} tone={DUP_TONE[it.duplicateRisk]} />}
                      <span className="ml-auto text-[11px] text-slate-400">{it.receivedAt}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">{it.cleanedSummary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span><span className="text-slate-400">From</span> {it.senderName} · {it.sourceChannel}</span>
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
                  Select an intake item to review its details, classification, and routing actions.
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
                    <div className={`mt-1 rounded-xl p-3 text-sm ${selected.sensitivity !== "normal" ? "bg-rose-50 text-rose-900 ring-1 ring-rose-100" : "bg-slate-50 text-slate-700"}`}>
                      {selected.sensitivity !== "normal" && (
                        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-500"><Lock className="h-3 w-3" /> Sensitive — do not share broadly</p>
                      )}
                      {selected.rawMessage}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">From {selected.senderName} ({selected.senderHandle}) · {selected.sourceChannel} · {selected.receivedAt}</p>
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

                  {selected.status !== "routed" && selected.status !== "archived" && (
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
    </div>
  );
}
