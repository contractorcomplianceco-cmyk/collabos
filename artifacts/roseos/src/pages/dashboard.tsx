import React from "react";
import { Link } from "wouter";
import {
  Target, Users, Lightbulb, Search, FileBarChart, Activity, ClipboardCheck,
  Brain, ArrowRight, Download, TrendingUp, TrendingDown, FolderKanban, Sparkles,
  Heart, FileText,
} from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import {
  KpiWidget, SectionCard, StatusChip, ClassificationBadge,
} from "@/components/shared";
import {
  projects, companyRecords, reports,
  duplicateRisks, sentimentSignals, competitors,
} from "@/data/seed";

const POPULAR_SEARCHES = ["user onboarding", "qualifier scoring", "automation registry"];

const WHATS_NEW = [
  { id: "wn-1", title: "Duplicate Radar engine", note: "Smarter overlap detection across ideas & builds.", date: "Jun 13" },
  { id: "wn-2", title: "Team Pulse 2.0", note: "Sentiment trends by department.", date: "Jun 10" },
  { id: "wn-3", title: "Solution Finder upgrades", note: "Answers grounded in Company Brain records.", date: "Jun 8" },
];

function ideaTag(momentum: number) {
  if (momentum >= 85) return { label: "Hot", tone: "rose" as const };
  if (momentum >= 70) return { label: "Rising", tone: "amber" as const };
  return { label: "New", tone: "sky" as const };
}

function threatTone(threat: string) {
  if (threat === "high") return "rose" as const;
  if (threat === "medium") return "amber" as const;
  if (threat === "watch") return "violet" as const;
  return "emerald" as const;
}

export default function Dashboard() {
  const { ideas, recommendations, currentRole } = useAppState();

  const greeting =
    currentRole === "Carmen" ? "Carmen" : currentRole === "Rose" ? "Rose" : currentRole;

  const topDuplicates = [...duplicateRisks].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  const topIdeas = [...ideas].sort((a, b) => b.momentum - a.momentum).slice(0, 3);
  const topCompetitors = competitors.slice(0, 3);
  const pendingRecs = recommendations.filter((r) => r.status === "pending");
  const queuePreview = pendingRecs.slice(0, 4);
  const topRec = recommendations[0];

  return (
    <div className="space-y-7 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {greeting}</h1>
        <p className="mt-1 text-sm text-slate-500">Your collaboration intelligence at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiWidget label="Active Projects" value={projects.length} sub="across all departments" icon={FolderKanban} gradient="from-rose-500 to-pink-500" delta="+12%" />
        <KpiWidget label="Solutions Found" value={companyRecords.length} sub="in Company Brain" icon={Search} gradient="from-sky-500 to-blue-500" delta="+18%" />
        <KpiWidget label="Ideas Generated" value={ideas.length} sub="in the innovation pipeline" icon={Lightbulb} gradient="from-amber-500 to-orange-500" delta="+24%" />
        <KpiWidget label="Dupes Avoided" value={duplicateRisks.length} sub="overlaps flagged early" icon={Target} gradient="from-emerald-500 to-teal-500" delta="+15%" />
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Duplicate Effort Radar */}
        <SectionCard
          title="Duplicate Effort Radar"
          icon={Target}
          accent="rose"
          action={<span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">High overlap</span>}
        >
          <div className="space-y-2.5">
            {topDuplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <span className="text-sm font-medium text-slate-700">{d.title}</span>
                <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">{d.similarity}% match</span>
              </div>
            ))}
          </div>
          <Link href="/duplicate-radar" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline">
            View all duplicates <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </SectionCard>

        {/* Team Pulse */}
        <SectionCard title="Team Pulse" icon={Users} accent="sky" action={<Link href="/team-pulse" className="text-xs font-semibold text-sky-500 hover:underline">View</Link>}>
          <div className="space-y-3">
            {sentimentSignals.map((s) => {
              const pct = Math.round(((s.score + 1) / 2) * 100);
              const bar = s.score >= 0.6 ? "from-emerald-400 to-teal-500" : s.score >= 0.3 ? "from-amber-400 to-orange-500" : "from-rose-400 to-rose-500";
              const val = s.score >= 0 ? `+${s.score.toFixed(2)}` : s.score.toFixed(2);
              return (
                <div key={s.team}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{s.team}</span>
                    <span className="font-semibold text-slate-500">{val}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full bg-gradient-to-r ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Positive</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Neutral</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Negative</span>
          </div>
        </SectionCard>

        {/* Solution Finder */}
        <SectionCard title="Solution Finder" icon={Search} accent="violet">
          <p className="text-sm text-slate-600">Find what&apos;s already been solved before starting new work.</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input readOnly placeholder="Describe what you need..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:outline-none" />
            </div>
            <Link href="/solution-finder" className="rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-600">Search</Link>
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Popular searches</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {POPULAR_SEARCHES.map((q) => (
              <Link key={q} href="/solution-finder" className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-100">{q}</Link>
            ))}
          </div>
        </SectionCard>

        {/* Innovation Lab */}
        <SectionCard title="Innovation Lab" icon={Lightbulb} accent="amber" action={<Link href="/innovation-lab" className="text-xs font-semibold text-amber-500 hover:underline">View</Link>}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top idea clusters</p>
          <ul className="mt-2 space-y-2.5">
            {topIdeas.map((i) => {
              const tag = ideaTag(i.momentum);
              return (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">{i.title}</span>
                  <StatusChip label={tag.label} tone={tag.tone} />
                </li>
              );
            })}
          </ul>
          <Link href="/innovation-lab" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-500 hover:underline">
            View all ideas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </SectionCard>

        {/* Executive Reports */}
        <SectionCard title="Executive Reports" icon={FileBarChart} accent="violet" action={<Link href="/executive-reports" className="text-xs font-semibold text-violet-500 hover:underline">All</Link>}>
          <ul className="space-y-2.5">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{r.title}</p>
                    <p className="text-[10px] text-slate-400">{r.type} · {r.date}</p>
                  </div>
                </div>
                <Link href="/executive-reports" aria-label={`Open ${r.title}`} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-violet-500"><Download className="h-4 w-4" /></Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Market Pulse */}
        <SectionCard title="Market Pulse" icon={Activity} accent="emerald" action={<Link href="/market-pulse" className="text-xs font-semibold text-emerald-500 hover:underline">View</Link>}>
          <ul className="space-y-2.5">
            {topCompetitors.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">{c.name}</span>
                <div className="flex items-center gap-2">
                  <StatusChip label={c.threat} tone={threatTone(c.threat)} />
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${c.movement >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {c.movement >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {c.movement >= 0 ? `+${c.movement}` : c.movement}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Review Queue */}
        <SectionCard
          title="Review Queue"
          icon={ClipboardCheck}
          accent="rose"
          action={<Link href="/review-queue" className="text-xs font-semibold text-rose-500 hover:underline">View all ({pendingRecs.length})</Link>}
        >
          <ul className="space-y-2.5">
            {queuePreview.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-100 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">{r.source}</span>
                  <ClassificationBadge value={r.classification} />
                </div>
                <p className="mt-1 text-sm text-slate-700">{r.recommendation}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* AI Recommendation */}
        <div className="flex flex-col rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-blue-500 text-white shadow-sm"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">AI Recommendation</h2>
              <p className="text-[11px] text-slate-500">Rose Brain has insights</p>
            </div>
          </div>
          {topRec && (
            <div className="mt-3 rounded-xl bg-white/70 p-3">
              <ClassificationBadge value={topRec.classification} />
              <p className="mt-2 text-sm text-slate-700">{topRec.recommendation}</p>
            </div>
          )}
          <Link href="/review-queue" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ marginTop: topRec ? undefined : "0.75rem" }}>
            View recommendation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* What's New */}
        <SectionCard title="What's New" icon={Sparkles} accent="emerald">
          <ul className="space-y-3">
            {WHATS_NEW.map((w) => (
              <li key={w.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{w.title}</span>
                    <span className="text-[10px] text-slate-400">{w.date}</span>
                  </div>
                  <p className="text-xs text-slate-500">{w.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-5 text-xs text-slate-400">
        RoseOS Collab Command Center · Built with <Heart className="h-3.5 w-3.5 text-rose-400" /> for collaboration
      </div>
    </div>
  );
}
