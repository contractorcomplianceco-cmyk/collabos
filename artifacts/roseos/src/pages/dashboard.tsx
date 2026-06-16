import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Copy, Users, Lightbulb, ClipboardCheck, Sparkles, AlertTriangle,
  Ban, Clock, UserX, GitBranch, TrendingUp, CalendarClock, Brain,
  ArrowRight, Activity, FileBarChart, Crown,
} from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import {
  KpiWidget, SectionCard, RiskBadge, StatusChip, ClassificationBadge, Donut,
} from "@/components/shared";
import {
  projects, blockers, decisions, alerts, marketSignals, reports,
  duplicateRisks, feedbackItems,
} from "@/data/seed";

const DEPARTMENTS = ["All", "Systems", "Compliance", "Sales", "Marketing", "Strategy", "Leadership"];

export default function Dashboard() {
  const { ideas, recommendations, mindMeldItems, currentRole } = useAppState();
  const [dept, setDept] = useState("All");

  const filteredProjects = useMemo(
    () => (dept === "All" ? projects : projects.filter((p) => p.department === dept)),
    [dept],
  );

  const stale = filteredProjects.filter((p) => p.status === "stale");
  const unowned = filteredProjects.filter((p) => !p.owner);
  const activeBuilds = filteredProjects.filter((p) => p.status === "active");
  const openDecisions = decisions.filter((d) => d.status === "open");
  const pendingApprovals = recommendations.filter((r) => r.status === "pending");
  const momentumIdeas = [...ideas].sort((a, b) => b.momentum - a.momentum).slice(0, 4);
  const pulseScore = 74;

  const greeting = currentRole === "Carmen" ? "Carmen" : "Rose";

  return (
    <div className="space-y-6 p-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-rose-500 to-orange-400 p-7 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">Collab Command Center</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back, {greeting}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">
            Here's what's happening across Rose OS today — duplicate efforts, team support needs,
            momentum, and the decisions waiting on leadership.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/duplicate-radar" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50">
              Review duplicates <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/review-queue" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25">
              Approval queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiWidget label="Duplicate Alerts" value={duplicateRisks.length} sub="overlaps detected" icon={Copy} gradient="from-rose-500 to-pink-500" />
        <KpiWidget label="Team Pulse" value={`${pulseScore}`} sub="supportive score" icon={Users} gradient="from-sky-500 to-blue-500" />
        <KpiWidget label="Innovation Ideas" value={ideas.length} sub="in the pipeline" icon={Lightbulb} gradient="from-amber-500 to-orange-500" />
        <KpiWidget label="Approval Queue" value={pendingApprovals.length} sub="awaiting review" icon={ClipboardCheck} gradient="from-violet-500 to-fuchsia-500" />
        <KpiWidget label="Rose OS Recommends" value={recommendations.length} sub="draft suggestions" icon={Sparkles} gradient="from-emerald-500 to-teal-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filter by department</span>
        {DEPARTMENTS.map((d) => (
          <button
            key={d}
            onClick={() => setDept(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              dept === d ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Duplicate Alerts" icon={Copy} accent="rose" action={<Link href="/duplicate-radar" className="text-xs font-medium text-rose-500 hover:underline">View all</Link>}>
            <div className="space-y-3">
              {duplicateRisks.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{d.title}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">{d.similarity}% match</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{d.reason}</p>
                  </div>
                  <RiskBadge value={d.risk} />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SectionCard title="Blockers" icon={Ban} accent="rose">
              <ul className="space-y-2.5">
                {blockers.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700">{b.title}</span>
                    <RiskBadge value={b.risk} />
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Stale & Unowned Work" icon={Clock} accent="amber">
              <ul className="space-y-2.5 text-sm">
                {stale.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{p.name}</span>
                    <StatusChip label="stale" tone="amber" />
                  </li>
                ))}
                {unowned.map((p) => (
                  <li key={`u-${p.id}`} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-700"><UserX className="h-3.5 w-3.5 text-rose-400" />{p.name}</span>
                    <StatusChip label="no owner" tone="rose" />
                  </li>
                ))}
                {stale.length === 0 && unowned.length === 0 && <li className="text-slate-400">All work owned and active.</li>}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Active Build Items" icon={GitBranch} accent="sky">
            <div className="space-y-3">
              {activeBuilds.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                    <span className="text-xs font-medium text-slate-500">{p.owner ?? "Unassigned"}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{p.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SectionCard title="Ideas Gaining Momentum" icon={TrendingUp} accent="amber">
              <ul className="space-y-3">
                {momentumIdeas.map((i) => (
                  <li key={i.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{i.title}</span>
                      <span className="text-xs font-bold text-amber-600">{i.momentum}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${i.momentum}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Open Decisions" icon={ClipboardCheck} accent="violet">
              <ul className="space-y-2.5 text-sm">
                {openDecisions.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700">{d.title}</span>
                    <RiskBadge value={d.risk} />
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Support Needs" icon={Users} accent="sky" action={<Link href="/team-pulse" className="text-xs font-medium text-sky-500 hover:underline">Team Pulse</Link>}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {feedbackItems.slice(0, 4).map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between">
                    <StatusChip label={f.supportNeed} tone="sky" />
                    <span className="text-xs text-slate-400">×{f.count}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{f.summary}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Rose OS Recommends */}
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-rose-600">
              <Sparkles className="h-4 w-4" /> Rose OS Recommends
            </h2>
            <ul className="mt-3 space-y-3">
              {recommendations.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-xl bg-white/70 p-3">
                  <ClassificationBadge value={r.classification} />
                  <p className="mt-2 text-sm text-slate-700">{r.recommendation}</p>
                </li>
              ))}
            </ul>
            <Link href="/review-queue" className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
              Open Review Queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mind Meld preview */}
          <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Brain className="h-4 w-4" /> Mind Meld Room</h2>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">Rose &amp; Carmen</span>
              </div>
              <p className="mt-1 text-xs text-white/85">Private alignment space</p>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-center">
                <Donut value={mindMeldItems[0]?.alignmentScore ?? 80} label="aligned" accent="#a855f7" size={96} />
              </div>
              <div className="mt-3 space-y-2">
                {mindMeldItems.slice(0, 2).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-violet-50/60 px-3 py-2 text-xs">
                    <span className="font-medium text-slate-700">{m.title}</span>
                    <StatusChip label={m.alignment} tone="violet" />
                  </div>
                ))}
              </div>
              <Link href="/mind-meld" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-600 transition hover:bg-violet-50">
                Enter the room <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <SectionCard title="Recommended Leadership Actions" icon={Crown} accent="rose">
            <ul className="space-y-2.5 text-sm text-slate-700">
              <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />Assign an owner to Document Collection.</li>
              <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />Resolve Services Hub pricing decision.</li>
              <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />Re-engage stale Marketing Command Center.</li>
            </ul>
          </SectionCard>

          <SectionCard title="Market Signals" icon={Activity} accent="emerald" action={<Link href="/market-pulse" className="text-xs font-medium text-emerald-500 hover:underline">View</Link>}>
            <ul className="space-y-2.5">
              {marketSignals.slice(0, 3).map((m) => (
                <li key={m.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{m.source}</span>
                    <RiskBadge value={m.risk} />
                  </div>
                  <p className="text-xs text-slate-500">{m.summary}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Latest Reports" icon={FileBarChart} accent="violet" action={<Link href="/executive-reports" className="text-xs font-medium text-violet-500 hover:underline">All reports</Link>}>
            <ul className="space-y-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{r.title}</span>
                  <span className="text-xs text-slate-400">{r.date}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Upcoming Deadlines" icon={CalendarClock} accent="orange">
            <ul className="space-y-2 text-sm">
              {projects.filter((p) => p.deadline).sort((a, b) => (a.deadline! > b.deadline! ? 1 : -1)).slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{p.name}</span>
                  <span className="text-xs font-medium text-orange-500">{p.deadline}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
