import React, { useState } from "react";
import { FileBarChart, Download, Sparkles, AlertTriangle, ClipboardList, ArrowRight } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared";
import { reports, projects, blockers, decisions } from "@/data/seed";
import { generateReport, reportFromTemplate, type GeneratedReport } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";

const REPORT_TYPES = [
  "Project Health", "Duplicate Work", "Team Support Needs", "Open Decisions",
  "Missing Documentation", "Automation Opportunity", "Build Readiness",
  "Market Pulse", "Growth Opportunity", "Mind Meld Alignment",
];

export default function ExecutiveReports() {
  const { toast } = useToast();
  const [active, setActive] = useState<{ type: string; data: GeneratedReport } | null>(null);

  const generate = (type: string) => {
    setActive({ type, data: generateReport(`${type} Report`, { projects, blockers, decisions }) });
    toast({ title: `${type} report generated`, description: "Built from live Rose OS data." });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Executive Reports" subtitle="Leadership-ready summaries generated from live data." icon={FileBarChart} accent="violet" />

      <SectionCard title="Generate a Report" icon={Sparkles} accent="violet">
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((t) => (
            <button key={t} onClick={() => generate(t)} className="rounded-full bg-violet-50 px-3.5 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100">
              {t}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Saved Reports</p>
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => { setActive({ type: r.type, data: reportFromTemplate(r) }); }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{r.title}</span>
                <span className="text-xs text-slate-400">{r.date}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{r.type}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!active ? (
            <EmptyState message="Generate or select a report to view the executive summary." />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">{active.type}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">Executive Summary</h2>
                </div>
                <button
                  onClick={() => toast({ title: "Export started", description: "Mock export — PDF would download here." })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600"
                >
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>

              <div className="mt-4 rounded-xl bg-violet-50/60 p-4 text-sm text-slate-700">{active.data.summary}</div>

              <ReportBlock title="Key Findings" icon={ClipboardList} items={active.data.findings} />
              <ReportBlock title="Risks" icon={AlertTriangle} items={active.data.risks} tone="rose" />
              <ReportBlock title="Recommendations" icon={Sparkles} items={active.data.recommendations} tone="violet" />
              <ReportBlock title="Decisions Needed" icon={ArrowRight} items={active.data.decisionsNeeded} tone="amber" />
              <ReportBlock title="Next Steps" icon={ArrowRight} items={active.data.nextSteps} tone="emerald" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportBlock({ title, icon: Icon, items, tone = "slate" }: { title: string; icon: React.ElementType; items: string[]; tone?: string }) {
  if (!items || items.length === 0) return null;
  const tones: Record<string, string> = { slate: "text-slate-500", rose: "text-rose-500", violet: "text-violet-500", amber: "text-amber-500", emerald: "text-emerald-500" };
  return (
    <div className="mt-5">
      <p className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}><Icon className="h-3.5 w-3.5" />{title}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />{it}
          </li>
        ))}
      </ul>
    </div>
  );
}
