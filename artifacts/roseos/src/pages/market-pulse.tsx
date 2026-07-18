import React, { useEffect, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus, Globe, RefreshCw, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { PageHeader, SectionCard, RiskBadge, ApprovalRouteBadge, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";
import { useGetMarketStatus } from "@workspace/api-client-react";

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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
  const { marketSignals, competitors, marketPulseLoading, refreshMarketNews } = useAppState();
  const { toast } = useToast();
  const { data: status, refetch: refetchStatus } = useGetMarketStatus();
  const [type, setType] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const types = ["all", ...Array.from(new Set(marketSignals.map((m) => m.signalType)))];
  const filtered = type === "all" ? marketSignals : marketSignals.filter((m) => m.signalType === type);

  // Auto-refresh on first load if we've never pulled, or it's been > 3 hours.
  useEffect(() => {
    if (marketPulseLoading) return;
    const last = status?.lastRefreshedAt ? new Date(status.lastRefreshedAt).getTime() : 0;
    const stale = !last || Date.now() - last > 3 * 60 * 60 * 1000;
    if (stale && !refreshing) void doRefresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketPulseLoading, status?.lastRefreshedAt]);

  const doRefresh = async (silent = false) => {
    setRefreshing(true);
    const result = await refreshMarketNews();
    await refetchStatus();
    setRefreshing(false);
    if (!silent) {
      if (result) {
        toast({ title: "Signals refreshed", description: `${result.inserted} new from ${result.terms.length} watched terms.` });
      } else {
        toast({ title: "Couldn't refresh", description: "Add competitors/keywords in Settings, or try again.", variant: "destructive" });
      }
    }
  };

  const lastLabel = timeAgo(status?.lastRefreshedAt);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Market Pulse" subtitle="Live news signals for the competitors and keywords you watch." icon={Activity} accent="emerald" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
        <div>
          <span className="font-semibold">Live news monitoring.</span> Signals are pulled from public news for your watched terms. Manage them in{" "}
          <Link href="/settings" className="font-semibold underline">Settings</Link>.
          {lastLabel ? <span className="ml-1 text-emerald-600">Last updated {lastLabel}.</span> : null}
        </div>
        <button
          onClick={() => void doRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh signals"}
        </button>
      </div>

      <SectionCard title="Competitor Watch" icon={Globe} accent="emerald">
        {marketPulseLoading ? (
          <p className="text-sm text-slate-500">Loading market data…</p>
        ) : competitors.length === 0 ? (
          <EmptyState
            message="No competitors tracked yet."
            hint="Add competitor names in Settings → Competitors Watched. Signals appear here as market data is captured."
            action={<Link href="/settings" className="text-xs font-semibold text-emerald-600 hover:underline">Open Settings</Link>}
          />
        ) : (
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
        )}
      </SectionCard>

      {marketSignals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {types.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${type === t ? "bg-emerald-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {t.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      )}

      {marketPulseLoading ? null : filtered.length === 0 ? (
        <EmptyState
          message="No market signals yet."
          hint="Add competitors and keywords in Settings, then Refresh signals to pull live news."
          action={<button onClick={() => void doRefresh()} disabled={refreshing} className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh signals now"}</button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={m.signalType} tone="emerald" />
                    {m.matchedTerm ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{m.matchedTerm}</span> : null}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-500">{m.source}</h3>
                </div>
                <RiskBadge value={m.risk} />
              </div>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-start gap-1 text-sm font-semibold text-slate-900 hover:text-emerald-700">
                  {m.summary} <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                </a>
              ) : (
                <p className="mt-2 text-sm text-slate-600">{m.summary}</p>
              )}
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
      )}
    </div>
  );
}
