import React from "react";
import { Settings as SettingsIcon, Database, ShieldCheck, Bell, Plug, Lock, RotateCcw } from "lucide-react";
import { PageHeader, SectionCard, StatusChip } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";

const STATE_TONE: Record<string, "emerald" | "amber" | "violet" | "slate" | "sky"> = {
  simulated: "emerald", future: "amber", planned: "violet", disabled: "slate", sample: "sky",
};

const ROLE_MATRIX = [
  { role: "Rose / Leadership", access: "Full access · approves direction, pricing, client-facing & final decisions · Mind Meld" },
  { role: "Carmen / Systems Review", access: "Full systems access · approves process, CRM, automation & build changes · Mind Meld" },
  { role: "Admin", access: "Administrative access across modules · Mind Meld" },
  { role: "Department Lead", access: "Department view · submit & manage team work · no leadership approvals" },
  { role: "Team Member", access: "Submit ideas, updates & support needs · read dashboards" },
  { role: "Viewer", access: "Read-only access · cannot submit or approve" },
];

export default function SettingsPage() {
  const { settings, settingsLoading, updateSettings, resetData, companyRecords, integrations } = useAppState();
  const { toast } = useToast();

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Settings, Sources & Permissions" subtitle="Configure data sources, thresholds, permissions, and privacy." icon={SettingsIcon} accent="sky"
        actions={
          <button onClick={() => { resetData(); toast({ title: "Local preferences reset", description: "Your role preference was refreshed. Shared workspace data is unchanged." }); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Reset local preferences
          </button>
        }
      />

      {settingsLoading ? (
        <p className="text-sm text-slate-500">Loading workspace settings…</p>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Detection & Alerts" icon={Bell} accent="rose">
          <div className="space-y-5">
            <Slider label="Duplicate sensitivity" value={settings.duplicateSensitivity} onChange={(v) => updateSettings({ duplicateSensitivity: v })} suffix="%" />
            <Slider label="Alert threshold (repeat count)" value={settings.alertThreshold} min={1} max={10} onChange={(v) => updateSettings({ alertThreshold: v })} />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Report cadence</p>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((c) => (
                  <button key={c} onClick={() => updateSettings({ reportCadence: c })} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${settings.reportCadence === c ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Privacy" icon={Lock} accent="violet">
          <Toggle label="Mind Meld Room private (Rose & Carmen only)" checked={settings.mindMeldPrivate} onChange={(v) => updateSettings({ mindMeldPrivate: v })} />
          <Toggle label="Email alerts" checked={settings.emailAlerts} onChange={(v) => { updateSettings({ emailAlerts: v }); toast({ title: v ? "Email alerts enabled" : "Email alerts disabled", description: "Preference saved. Live email delivery will activate when the email integration is approved." }); }} />
          <p className="mt-3 rounded-xl bg-violet-50/60 p-3 text-xs text-slate-600">Mind Meld content is end-to-end private to Rose and Carmen. Handoffs create private items and never auto-create official company decisions.</p>
        </SectionCard>

        <SectionCard title="Company Brain Sources" icon={Database} accent="emerald">
          <ul className="space-y-2">
            {companyRecords.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-700">{r.title}</span>
                <StatusChip label={r.type} tone="emerald" />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Integration Status" icon={Plug} accent="sky">
          <ul className="space-y-2">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-700">{i.name}</span>
                <StatusChip label={i.status} tone={STATE_TONE[i.state]} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">Integration status is stored in the shared database. Live external connections are not active yet — approvals are required before each integration goes live.</p>
        </SectionCard>

        <SectionCard title="Roles & Permissions" icon={ShieldCheck} accent="rose" className="lg:col-span-2">
          <div className="space-y-2">
            {ROLE_MATRIX.map((r) => (
              <div key={r.role} className="flex flex-col gap-1 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-slate-800">{r.role}</span>
                <span className="text-xs text-slate-500">{r.access}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Competitors Watched" icon={Database} accent="emerald">
          <div className="flex flex-wrap gap-2">
            {settings.competitors.map((c) => <StatusChip key={c} label={c} tone="slate" />)}
          </div>
        </SectionCard>

        <SectionCard title="Market Keywords" icon={Database} accent="violet">
          <div className="flex flex-wrap gap-2">
            {settings.marketKeywords.map((k) => <StatusChip key={k} label={k} tone="violet" />)}
          </div>
        </SectionCard>
      </div>
      )}
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 100, suffix = "" }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="text-sm font-bold text-slate-700">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-rose-500" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <button onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-rose-500" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
