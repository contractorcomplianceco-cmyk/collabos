import React, { useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, Globe, ArrowRight } from "lucide-react";
import { PageHeader, SectionCard, RiskBadge, ApprovalRouteBadge, StatusChip } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 90, h = 30;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#f43f5e" : "#10b981"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const THREAT_TONE: Record<string, "rose" | "amber" | "emerald" | "slate"> = { high: "rose", medium: "amber", low: "emerald", watch: "slate" };

export default function MarketPulse() {
  const { marketSignals, competitors } = useAppState();
  const [type, setType] = useState("all");
  const types = ["all", ...Array.from(new Set(marketSignals.map((m) => m.signalType)))];
  const filtered = type === "all" ? marketSignals : marketSignals.filter((m) => m.signalType === type);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Market Pulse" subtitle="Shared public-source market signals. Live monitoring integrations are pending." icon={Activity} accent="emerald" />

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
        <span className="font-semibold">Public-source monitoring.</span> Signals are stored in the shared workspace database. No live external monitoring connection is active yet.
      </div>

      <SectionCard title="Competitor Watch" icon={Globe} accent="emerald">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {competitors.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{c.name}</span>
                <StatusChip label={c.threat} tone={THREAT_TONE[c.threat]} />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <Sparkline data={c.series} up={c.trend === "up"} />
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${c.movement > 0 ? "text-rose-500" : c.movement < 0 ? "text-emerald-500" : "text-slate-400"}`}>
                  {c.trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : c.trend === "down" ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {c.movement > 0 ? `+${c.movement}` : c.movement}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{c.newsCount} recent signals</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${type === t ? "bg-emerald-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {t.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((m) => (
          <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <StatusChip label={m.signalType} tone="emerald" />
                <h3 className="mt-2 text-base font-bold text-slate-900">{m.source}</h3>
              </div>
              <RiskBadge value={m.risk} />
            </div>
            <p className="mt-2 text-sm text-slate-600">{m.summary}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Opportunity</p>
                <p className="mt-0.5 text-slate-700">{m.opportunity}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended response</p>
                <p className="mt-0.5 text-slate-700">{m.recommendedResponse}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Found {m.dateFound}</span>
              <ApprovalRouteBadge value={m.reviewOwner} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
