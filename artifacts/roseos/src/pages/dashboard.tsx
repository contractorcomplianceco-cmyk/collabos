import React from "react";
import { Link } from "wouter";
import {
  Target, Users, Lightbulb, Search, FileBarChart, Activity, ClipboardCheck,
  Brain, ArrowRight, Download, TrendingUp, TrendingDown, FolderKanban, Sparkles,
  Heart, FileText, Check, X,
} from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { useActivityNotifications } from "@/hooks/use-activity-notifications";
import { canApprove, canViewSensitive } from "@/lib/helpers";
import {
  KpiWidget, SectionCard, StatusChip, ClassificationBadge, EmptyState,
} from "@/components/shared";

const POPULAR_SEARCHES = ["client onboarding", "qualifier scoring", "automation registry"];

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

function MiniRadar({ points }: { points: number[] }) {
  const cx = 50, cy = 50;
  const dots = points.map((p, i) => {
    const angle = (i / Math.max(points.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = 10 + (1 - p / 100) * 32;
    const color = p >= 80 ? "#f43f5e" : p >= 70 ? "#fb923c" : "#38bdf8";
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, color, big: p >= 80 };
  });
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0">
      {[40, 28, 16].map((r) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#fbcfe8" strokeWidth="1" />)}
      <line x1="50" y1="8" x2="50" y2="92" stroke="#fce7f3" strokeWidth="1" />
      <line x1="8" y1="50" x2="92" y2="50" stroke="#fce7f3" strokeWidth="1" />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.big ? 4 : 3} fill={d.color} />)}
      <circle cx={cx} cy={cy} r="9" fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity="0.35" />
      <circle cx={cx} cy={cy} r="5" fill="#f43f5e" />
    </svg>
  );
}

function AreaSpark({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 100, h = 34;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 6) - 3] as const);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function approverAvatars(route: string): { ini: string; cls: string }[] {
  if (route === "both") return [{ ini: "R", cls: "bg-rose-400" }, { ini: "C", cls: "bg-sky-400" }];
  if (route === "carmen") return [{ ini: "C", cls: "bg-sky-400" }];
  if (route === "rose") return [{ ini: "R", cls: "bg-rose-400" }];
  return [{ ini: "–", cls: "bg-slate-300" }];
}

const BUBBLE_POS = [
  { left: "2%", top: "20%" },
  { left: "38%", top: "2%" },
  { left: "26%", top: "46%" },
  { left: "62%", top: "34%" },
  { left: "8%", top: "64%" },
];
function bubbleColor(score: number) {
  if (score >= 0.6) return "from-emerald-300 to-teal-400 text-emerald-900";
  if (score >= 0.3) return "from-amber-200 to-orange-300 text-amber-900";
  return "from-rose-300 to-rose-400 text-rose-900";
}

export default function Dashboard() {
  const { ideas, recommendations, currentRole, setRecommendationStatus, intakeItems, meldTimeline, memoryCandidates, projects, projectTasks, companyRecords, duplicateRisks, sentimentSignals, competitors, reports } = useAppState();
  const { sinceLastVisit, lastVisitLabel } = useActivityNotifications();

  const greeting =
    currentRole === "Carmen" ? "Carmen" : currentRole === "Rose" ? "Rose" : currentRole;

  const topDuplicates = [...duplicateRisks].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  const topIdeas = [...ideas].sort((a, b) => b.momentum - a.momentum).slice(0, 3);
  const topCompetitors = competitors.slice(0, 3);
  const openTasks = projectTasks.filter((t) => t.status !== "done").slice(0, 6);
  const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const pendingRecs = recommendations.filter((r) => r.status === "pending");
  const queuePreview = pendingRecs.slice(0, 4);
  const topRec = recommendations[0];

  const isRose = currentRole === "Rose" || currentRole === "Admin";
  const isCarmen = currentRole === "Carmen" || currentRole === "Admin";
  const isLeadership = isRose || isCarmen;
  const workspaceEmpty = projects.length === 0 && companyRecords.length === 0 && ideas.length === 0;

  const attentionItems: { id: string; label: string; detail: string; href: string; tone: "rose" | "amber" | "sky" | "violet" | "emerald" }[] = [];
  const awaitingMe = pendingRecs.filter((r) => {
    if (!canApprove(currentRole, r.requiredApprover)) return false;
    if (r.requiredApprover === "both") {
      if (currentRole === "Rose") return !r.approvals?.rose;
      if (currentRole === "Carmen") return !r.approvals?.carmen;
      return !(r.approvals?.rose && r.approvals?.carmen);
    }
    return true;
  });
  if (awaitingMe.length > 0) {
    attentionItems.push({ id: "att-recs", label: `${awaitingMe.length} approval${awaitingMe.length === 1 ? "" : "s"} waiting on you`, detail: awaitingMe[0].recommendation, href: "/review-queue", tone: "rose" });
  }
  const newIntake = intakeItems.filter((it) => it.status === "new" || it.status === "needs_review");
  if (newIntake.length > 0) {
    const top = newIntake[0];
    const intakeDetail = top.sensitivity !== "normal" && !canViewSensitive(currentRole)
      ? "Restricted — leadership review only"
      : top.cleanedSummary;
    attentionItems.push({ id: "att-intake", label: `${newIntake.length} intake message${newIntake.length === 1 ? "" : "s"} to review`, detail: intakeDetail, href: "/external-intake", tone: "sky" });
  }
  const dupIntake = intakeItems.filter((it) => it.duplicateRisk !== "none" && it.status !== "archived" && it.status !== "routed");
  if (dupIntake.length > 0) {
    attentionItems.push({ id: "att-dup", label: `${dupIntake.length} possible duplicate${dupIntake.length === 1 ? "" : "s"} flagged`, detail: "Review before new work is created.", href: "/external-intake", tone: "amber" });
  }
  if (isLeadership) {
    const needsMe = meldTimeline.filter((e) => !e.finalized && (e.needs === "both" || (e.needs === "rose" && isRose) || (e.needs === "carmen" && isCarmen)));
    if (needsMe.length > 0) {
      attentionItems.push({ id: "att-meld", label: `${needsMe.length} Mind Meld thread${needsMe.length === 1 ? "" : "s"} need${needsMe.length === 1 ? "s" : ""} your take`, detail: needsMe[0].itemTitle, href: "/mind-meld", tone: "violet" });
    }
    const proposedMemories = memoryCandidates.filter((m) => m.status === "proposed");
    if (proposedMemories.length > 0) {
      attentionItems.push({ id: "att-mem", label: `${proposedMemories.length} memory candidate${proposedMemories.length === 1 ? "" : "s"} awaiting approval`, detail: proposedMemories[0].summary, href: "/external-intake", tone: "emerald" });
    }
  }

  const ATT_TONE: Record<string, string> = {
    rose: "border-rose-100 bg-rose-50/70 text-rose-700",
    amber: "border-amber-100 bg-amber-50/70 text-amber-700",
    sky: "border-sky-100 bg-sky-50/70 text-sky-700",
    violet: "border-violet-100 bg-violet-50/70 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700",
  };

  return (
    <div className="space-y-7 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {greeting}</h1>
        <p className="mt-1 text-sm text-slate-500">Your collaboration workspace — starts empty and grows with real team data.</p>
      </div>

      {workspaceEmpty ? (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-violet-50 p-5">
          <p className="text-sm font-semibold text-slate-800">Getting started</p>
          <p className="mt-1 text-sm text-slate-600">No demo data is loaded. Add your first records and tasks, or wait for nightly project sync.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/solution-finder" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-600 ring-1 ring-violet-100 hover:bg-violet-50">Add Company Brain record</Link>
            <Link href="/project-tasks" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sky-600 ring-1 ring-sky-100 hover:bg-sky-50">Create a project task</Link>
            <Link href="/innovation-lab" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-100 hover:bg-amber-50">Submit an idea</Link>
            <Link href="/agent-queue" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-100 hover:bg-rose-50">Cursor Direct Request</Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Daily check:</span> When nothing is flagged below, manually review{" "}
        <Link href="/review-queue" className="font-semibold text-rose-600 hover:underline">Review Queue</Link> and{" "}
        <Link href="/agent-queue" className="font-semibold text-violet-600 hover:underline">Cursor Direct Requests</Link> once per day.
      </div>

      {/* Since your last visit */}
      <SectionCard
        title="Since Your Last Visit"
        icon={Activity}
        accent="sky"
        action={lastVisitLabel ? <StatusChip label={`Last check ${lastVisitLabel}`} tone="sky" /> : null}
      >
        {sinceLastVisit.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
            Nothing new in your key collaboration areas{lastVisitLabel ? ` since ${lastVisitLabel}` : ""}.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {sinceLastVisit.map((item) => (
              <Link key={item.id} href={item.href} className={`rounded-xl border p-3 transition hover:shadow-sm ${ATT_TONE[item.tone]}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <StatusChip label={`+${item.count}`} tone={item.tone === "slate" ? "slate" : item.tone} />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] opacity-80">{item.detail}</p>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[11px] text-slate-400">
          In-app activity only — no push or email. Visiting each module marks it as seen for your account.
        </p>
      </SectionCard>

      {/* What Needs My Attention */}
      <SectionCard
        title="What Needs My Attention?"
        icon={Sparkles}
        accent="rose"
        action={<AttentionPulse count={attentionItems.length} urgent={awaitingMe.length} />}
      >
        {attentionItems.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">You're all caught up — nothing is waiting on you right now.</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {attentionItems.map((a) => (
              <Link key={a.id} href={a.href} className={`rounded-xl border p-3 transition hover:shadow-sm ${ATT_TONE[a.tone]}`}>
                <p className="text-xs font-semibold">{a.label}</p>
                <p className="mt-1 line-clamp-2 text-[11px] opacity-80">{a.detail}</p>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[11px] text-slate-400">
          Personalized for your role — items that need action right now, not just since your last visit.
        </p>
      </SectionCard>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/projects" className="block transition hover:opacity-90">
          <KpiWidget label="Active Projects" value={projects.length} sub="across all departments" icon={FolderKanban} tone="blue" />
        </Link>
        <KpiWidget label="Open Tasks" value={projectTasks.filter((t) => t.status !== "done").length} sub="tracked in shared registry" icon={ClipboardCheck} tone="sky" />
        <KpiWidget label="Solutions Found" value={companyRecords.length} sub="in Company Brain" icon={Search} tone="emerald" />
        <KpiWidget label="Ideas Generated" value={ideas.length} sub="in the innovation pipeline" icon={Lightbulb} tone="violet" />
        <KpiWidget label="Dupes Avoided" value={duplicateRisks.length} sub="overlaps flagged early" icon={Target} tone="rose" />
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Project tasks */}
        <SectionCard
          title="Project Tasks"
          icon={FolderKanban}
          accent="blue"
          action={<Link href="/project-tasks" className="text-xs font-semibold text-sky-500 hover:underline">View all</Link>}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Shared project follow-up from the registry</p>
          <ul className="space-y-2">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{task.title}</p>
                  <p className="truncate text-[11px] text-slate-400">{projectNameById[task.projectId] ?? "Project"} · {task.owner ?? "Unassigned"}</p>
                </div>
                <StatusChip label={task.status.replace(/-/g, " ")} tone={task.status === "review" ? "amber" : task.status === "in-progress" ? "sky" : "slate"} />
              </li>
            ))}
            {openTasks.length === 0 ? (
              <li>
                <EmptyState message="No open project tasks." hint="Create tasks on the Project Tasks page — they are kept across nightly sync." action={<Link href="/project-tasks" className="text-xs font-semibold text-sky-600 hover:underline">Go to Project Tasks</Link>} />
              </li>
            ) : null}
          </ul>
        </SectionCard>

        {/* Duplicate Effort Radar */}
        <SectionCard
          title="Duplicate Effort Radar"
          icon={Target}
          accent="rose"
          action={topDuplicates.length > 0 ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">Overlap detected</span> : null}
        >
          {topDuplicates.length === 0 ? (
            <EmptyState message="No duplicate risks flagged yet." hint="Submit ideas and projects — overlaps surface as your registry grows." action={<Link href="/duplicate-radar" className="text-xs font-semibold text-rose-600 hover:underline">Open Duplicate Radar</Link>} />
          ) : (
          <>
          <div className="flex items-center gap-4">
            <MiniRadar points={topDuplicates.map((d) => d.similarity)} />
            <div className="flex-1 space-y-2">
              {topDuplicates.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium leading-tight text-slate-700">{d.title}</span>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600">{d.similarity}%</span>
                </div>
              ))}
            </div>
          </div>
          <Link href="/duplicate-radar" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:underline">
            View all duplicates <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          </>
          )}
        </SectionCard>

        {/* Team Pulse */}
        <SectionCard title="Team Pulse" icon={Users} accent="sky" action={<Link href="/team-pulse" className="text-xs font-semibold text-sky-500 hover:underline">View</Link>}>
          {sentimentSignals.length === 0 ? (
            <EmptyState message="No team sentiment signals yet." hint="Submit feedback on Team Pulse — supportive signals appear as they're collected." />
          ) : (
          <>
          <div className="relative h-44">
            {sentimentSignals.map((s, i) => {
              const pos = BUBBLE_POS[i] ?? BUBBLE_POS[0];
              const size = 50 + Math.max(s.score, 0.1) * 44;
              const val = s.score >= 0 ? `+${s.score.toFixed(2)}` : s.score.toFixed(2);
              return (
                <div
                  key={s.team}
                  title={s.theme}
                  className={`absolute flex flex-col items-center justify-center rounded-full bg-gradient-to-br shadow-sm ring-2 ring-white ${bubbleColor(s.score)}`}
                  style={{ left: pos.left, top: pos.top, width: size, height: size }}
                >
                  <span className="text-[10px] font-semibold leading-none">{s.team}</span>
                  <span className="text-[11px] font-bold leading-tight">{val}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Positive</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Neutral</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Negative</span>
          </div>
          </>
          )}
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
          {topIdeas.length === 0 ? (
            <EmptyState message="No ideas in the pipeline yet." hint="Submit your first idea in Innovation Lab to start clustering." action={<Link href="/innovation-lab" className="text-xs font-semibold text-amber-600 hover:underline">Submit an idea</Link>} />
          ) : (
          <>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top idea clusters gaining momentum</p>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {topIdeas.map((i) => {
              const tag = ideaTag(i.momentum);
              return (
                <Link key={i.id} href="/innovation-lab" className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-amber-200 hover:bg-amber-50/40">
                  <div className="flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Lightbulb className="h-4 w-4" /></div>
                    <StatusChip label={tag.label} tone={tag.tone} />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-tight text-slate-700">{i.title}</p>
                  <div className="mt-auto flex items-center gap-1.5 pt-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${i.momentum}%` }} /></div>
                    <span className="text-[10px] font-bold text-amber-600">{i.momentum}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link href="/innovation-lab" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-500 hover:underline">
            View all ideas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          </>
          )}
        </SectionCard>

        {/* Executive Reports */}
        <SectionCard title="Executive Reports" icon={FileBarChart} accent="violet" action={<Link href="/executive-reports" className="text-xs font-semibold text-violet-500 hover:underline">All</Link>}>
          {reports.length === 0 ? (
            <EmptyState message="No saved reports yet." hint="Generate leadership summaries from live project and task counts." action={<Link href="/executive-reports" className="text-xs font-semibold text-violet-600 hover:underline">Generate a report</Link>} />
          ) : (
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
          )}
        </SectionCard>

        {/* Market Pulse */}
        <SectionCard title="Market Pulse" icon={Activity} accent="emerald" action={<Link href="/market-pulse" className="text-xs font-semibold text-emerald-500 hover:underline">View market</Link>}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Competitor &amp; market movement</p>
          {topCompetitors.length === 0 ? (
            <EmptyState message="No competitors tracked." hint="Add competitors in Settings to start market monitoring." action={<Link href="/settings" className="text-xs font-semibold text-emerald-600 hover:underline">Open Settings</Link>} />
          ) : (
          <div className="grid grid-cols-3 gap-2">
            {topCompetitors.map((c) => {
              const up = c.movement >= 0;
              return (
                <Link key={c.id} href="/market-pulse" className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition hover:border-emerald-200 hover:bg-emerald-50/40">
                  <p className="truncate text-xs font-semibold text-slate-700">{c.name}</p>
                  <div className="mt-1"><StatusChip label={c.threat} tone={threatTone(c.threat)} /></div>
                  <div className="mt-2"><AreaSpark data={c.series} color={up ? "#10b981" : "#f43f5e"} /></div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? "text-emerald-600" : "text-rose-500"}`}>
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {up ? `+${c.movement}` : c.movement}%
                    </span>
                    <span className="text-[10px] text-slate-400">News {c.newsCount}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          )}
        </SectionCard>

        {/* Review Queue */}
        <SectionCard
          title="Review Queue"
          icon={ClipboardCheck}
          accent="rose"
          action={<Link href="/review-queue" className="text-xs font-semibold text-rose-500 hover:underline">View all ({pendingRecs.length})</Link>}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Items awaiting your review or approval</p>
          <ul className="space-y-2">
            {queuePreview.map((r) => (
              <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><Sparkles className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{r.recommendation}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ClassificationBadge value={r.classification} />
                    <span className="truncate text-[10px] text-slate-400">{r.source}</span>
                  </div>
                </div>
                <div className="flex -space-x-1.5">
                  {approverAvatars(r.requiredApprover).map((a, i) => (
                    <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${a.cls}`}>{a.ini}</span>
                  ))}
                </div>
                {canApprove(currentRole, r.requiredApprover) ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setRecommendationStatus(r.id, "approved", currentRole)}
                      aria-label="Approve"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setRecommendationStatus(r.id, "rejected", currentRole)}
                      aria-label="Reject"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition hover:bg-rose-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                    Requires {r.requiredApprover === "both" ? "Rose + Carmen" : r.requiredApprover}
                  </span>
                )}
              </li>
            ))}
            {queuePreview.length === 0 && <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">Queue is clear — nothing awaiting review.</li>}
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

        {/* Workspace status */}
        <SectionCard title="Workspace Status" icon={Sparkles} accent="emerald">
          <ul className="space-y-2 text-sm text-slate-600">
            <li>· Company Brain: {companyRecords.length} documented record{companyRecords.length === 1 ? "" : "s"}</li>
            <li>· Projects: {projects.length} in registry{projects.some((p) => p.lastSyncedAt) ? " (nightly sync active)" : ""}</li>
            <li>· Open tasks: {projectTasks.filter((t) => t.status !== "done").length} manual follow-ups</li>
            <li>· Integrations: pending approval — no live Cliq/WhatsApp yet</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/solution-finder" className="text-xs font-semibold text-violet-600 hover:underline">Company Brain</Link>
            <Link href="/agent-queue" className="text-xs font-semibold text-rose-600 hover:underline">Cursor Direct Requests</Link>
          </div>
        </SectionCard>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-5 text-xs text-slate-400">
        CollabOS · Built with <Heart className="h-3.5 w-3.5 text-rose-400" /> for collaboration
      </div>
    </div>
  );
}

function AttentionPulse({ count, urgent }: { count: number; urgent: number }) {
  const level = count === 0 ? "calm" : urgent > 0 || count >= 3 ? "high" : "active";
  const meta = {
    calm: { label: "Pulse: calm", dot: "bg-emerald-500", ring: "bg-emerald-400", text: "text-emerald-600", chip: "bg-emerald-50" },
    active: { label: "Pulse: active", dot: "bg-amber-500", ring: "bg-amber-400", text: "text-amber-600", chip: "bg-amber-50" },
    high: { label: "Pulse: high", dot: "bg-rose-500", ring: "bg-rose-400", text: "text-rose-600", chip: "bg-rose-50" },
  }[level];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${meta.chip} ${meta.text}`} title={`${count} item(s) need attention, ${urgent} waiting on your approval`}>
      <span className="relative flex h-2 w-2">
        {level !== "calm" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${meta.ring}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${meta.dot}`} />
      </span>
      {meta.label}{count > 0 ? ` · ${count}` : ""}
    </span>
  );
}
