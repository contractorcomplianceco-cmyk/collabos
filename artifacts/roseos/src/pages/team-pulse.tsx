import React, { useState } from "react";
import { Users, HeartHandshake, BookOpen, GraduationCap, Wrench, Lock, Plus } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, ApprovalRouteBadge } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canViewSensitive, canSubmit } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackType, PrivacyLevel } from "@/types";

const TYPE_TONE: Record<string, "sky" | "rose" | "amber" | "violet" | "emerald" | "orange"> = {
  "help-request": "sky", blocker: "rose", "repeated-question": "violet",
  confusion: "amber", workload: "orange", "missing-docs": "amber",
  "training-need": "emerald", "tool-friction": "sky",
};

export default function TeamPulse() {
  const { feedbackItems, feedbackLoading, addFeedback, currentRole, sentimentSignals, sops } = useAppState();
  const { toast } = useToast();
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<FeedbackType>("help-request");
  const [privacy, setPrivacy] = useState<PrivacyLevel>("internal");

  const visible = feedbackItems.filter((f) =>
    f.privacy === "leadership-only" ? canViewSensitive(currentRole) : true,
  );
  const topNeeds = [...visible].sort((a, b) => b.count - a.count).slice(0, 4);
  const hasSignals = sentimentSignals.length > 0 || visible.length > 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Team Pulse"
        subtitle="A supportive view of where people need help — never a scorecard."
        icon={Users}
        accent="sky"
      />

      {feedbackLoading ? (
        <p className="text-sm text-slate-500">Loading shared team feedback…</p>
      ) : (
      <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-800">
        <span className="font-semibold">Supportive by design.</span> Team Pulse surfaces where teammates need documentation,
        training, tools, or leadership support. It does not score or rank individuals.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Pulse Summary" icon={HeartHandshake} accent="sky" className="lg:col-span-1">
          {hasSignals ? (
            <>
              <p className="text-center text-sm text-slate-600">
                {visible.length} support need{visible.length === 1 ? "" : "s"} recorded
                {sentimentSignals.length > 0 ? ` across ${sentimentSignals.length} team signal${sentimentSignals.length === 1 ? "" : "s"}` : ""}.
              </p>
              <div className="mt-4 space-y-2">
                {sentimentSignals.map((s) => (
                  <div key={s.team}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{s.team}</span>
                      <span className="text-slate-400">{s.theme}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${s.score > 0.6 ? "bg-emerald-500" : s.score > 0.35 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${Math.round(s.score * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
              No team feedback yet. Submit a support need below — scores appear as feedback is collected, not from demo data.
            </p>
          )}
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Top Support Needs" icon={GraduationCap} accent="emerald">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {topNeeds.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <StatusChip label={f.type} tone={TYPE_TONE[f.type]} />
                    {f.privacy === "leadership-only" && <Lock className="h-3.5 w-3.5 text-rose-400" />}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{f.summary}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-600">Need: {f.supportNeed}</span>
                    <span className="text-xs text-slate-400">×{f.count}</span>
                  </div>
                  <div className="mt-2"><ApprovalRouteBadge value={f.approvalRoute} /></div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recommended Follow-ups" icon={BookOpen} accent="amber">
            <ul className="space-y-2 text-sm text-slate-700">
              {sops.filter((s) => s.status !== "current").map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="flex items-center gap-2">
                    {s.status === "missing" ? <Wrench className="h-4 w-4 text-rose-400" /> : <BookOpen className="h-4 w-4 text-amber-400" />}
                    {s.title} SOP — {s.status.replace("-", " ")}
                  </span>
                  <StatusChip label={s.area} tone="slate" />
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Raise a Support Need" icon={Plus} accent="sky">
            {canSubmit(currentRole) ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select value={type} onChange={(e) => setType(e.target.value as FeedbackType)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <option value="help-request">Help request</option>
                    <option value="blocker">Blocker</option>
                    <option value="repeated-question">Repeated question</option>
                    <option value="confusion">Confusion</option>
                    <option value="workload">Workload</option>
                    <option value="missing-docs">Missing docs</option>
                    <option value="training-need">Training need</option>
                    <option value="tool-friction">Tool friction</option>
                  </select>
                  <select value={privacy} onChange={(e) => setPrivacy(e.target.value as PrivacyLevel)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <option value="internal">Internal</option>
                    <option value="private">Private</option>
                    <option value="leadership-only">Leadership only</option>
                  </select>
                </div>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe what would help your team..."
                  className="h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
                <button
                  onClick={() => {
                    if (!summary.trim()) return;
                    addFeedback({
                      type, summary, submittedBy: currentRole, department: "Systems",
                      privacy, supportNeed: "Review needed", approvalRoute: "carmen",
                    });
                    setSummary("");
                    toast({ title: "Support need raised", description: "Routed for supportive follow-up." });
                  }}
                  disabled={!summary.trim()}
                  className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
                >
                  Submit support need
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Viewers can read team pulse but cannot submit support needs.</p>
            )}
          </SectionCard>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
