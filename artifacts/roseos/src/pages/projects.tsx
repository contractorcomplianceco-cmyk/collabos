import { Link } from "wouter";
import { FolderKanban, ArrowRight, ClipboardCheck } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, RiskBadge, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { humanLabel, HUMAN_PROJECT_STATUS } from "@/lib/ui-labels";
import type { ProjectStatus } from "@/types";

const STATUS_TONE: Record<ProjectStatus, "sky" | "rose" | "amber" | "slate" | "emerald" | "violet"> = {
  active: "sky",
  "at-risk": "rose",
  blocked: "rose",
  stale: "amber",
  complete: "emerald",
  planning: "violet",
};

export default function ProjectsPage() {
  const { projects, projectTasks, projectsLoading, blockers } = useAppState();
  const openTaskCountByProject = Object.fromEntries(
    projects.map((p) => [
      p.id,
      projectTasks.filter((t) => t.projectId === p.id && t.status !== "done").length,
    ]),
  );
  const blockerCountByProject = Object.fromEntries(
    projects.map((p) => [p.id, blockers.filter((b) => b.projectId === p.id).length]),
  );

  const sorted = [...projects].sort((a, b) => {
    const priority: Record<ProjectStatus, number> = {
      blocked: 0,
      "at-risk": 1,
      stale: 2,
      active: 3,
      planning: 4,
      complete: 5,
    };
    return priority[a.status] - priority[b.status] || b.progress - a.progress;
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Projects"
        subtitle="Projects your team is tracking — who's on them, how they're going, and what needs follow-up."
        icon={FolderKanban}
        accent="sky"
      />
      <p className="-mt-4 text-xs text-slate-400">
        Project details refresh overnight from the server.
        {projects.some((p) => p.lastSyncedAt)
          ? ` Last update: ${new Date(
              Math.max(...projects.map((p) => (p.lastSyncedAt ? Date.parse(p.lastSyncedAt) : 0))),
            ).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
          : null}
      </p>

      {projectsLoading ? (
        <p className="text-sm text-slate-500">Loading shared projects…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Active projects</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{projects.filter((p) => p.status === "active").length}</p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">Need attention</p>
              <p className="mt-1 text-2xl font-bold text-rose-700">
                {projects.filter((p) => p.status === "at-risk" || p.status === "blocked" || p.status === "stale").length}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500">Open tasks</p>
              <p className="mt-1 text-2xl font-bold text-sky-700">{projectTasks.filter((t) => t.status !== "done").length}</p>
            </div>
          </div>

          <SectionCard title="All Projects" icon={FolderKanban} accent="blue">
            <ul className="space-y-3">
              {sorted.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">{p.name}</h3>
                        <StatusChip label={humanLabel(HUMAN_PROJECT_STATUS, p.status)} tone={STATUS_TONE[p.status]} />
                        <RiskBadge value={p.risk} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span>{p.department}</span>
                        <span>{p.owner ?? "Unassigned"}</span>
                        {p.deadline ? <span>Due {p.deadline}</span> : null}
                        <span>Last activity {p.lastActivity}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-800">{p.progress}%</p>
                        <p className="text-[10px] text-slate-400">progress</p>
                      </div>
                      <Link
                        href="/project-tasks"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {openTaskCountByProject[p.id] ?? 0} open task{(openTaskCountByProject[p.id] ?? 0) === 1 ? "" : "s"}
                      </Link>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  {(blockerCountByProject[p.id] ?? 0) > 0 ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">
                      {blockerCountByProject[p.id]} blocker{(blockerCountByProject[p.id] ?? 0) === 1 ? "" : "s"} tracked
                    </p>
                  ) : null}
                  {p.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
              {sorted.length === 0 ? (
                <li>
                  <EmptyState
                    message="No projects yet."
                    hint="Projects show up after overnight updates from the server, or when you add them here."
                  />
                </li>
              ) : null}
            </ul>
          </SectionCard>

          <Link href="/project-tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:underline">
            View all project tasks <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
