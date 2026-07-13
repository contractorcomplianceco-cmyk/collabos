import React, { useMemo } from "react";
import { Link } from "wouter";
import { Route as PathIcon, FolderKanban, ClipboardCheck, AlertTriangle, ListChecks } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, EmptyState, RiskBadge } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { bucketProjectTaskOwner } from "@/lib/project-task-owners";
import { humanLabel, HUMAN_TASK_STATUS, HUMAN_PROJECT_STATUS } from "@/lib/ui-labels";

/**
 * Carmen’s path today — Rose’s drag priority order with Carmen’s open work under each project.
 */
export default function CarmenPathPage() {
  const { projects, projectTasks, blockers, projectsLoading, agentWorkItems, currentRole } = useAppState();

  const orderedProjects = useMemo(
    () =>
      [...projects].sort(
        (a, b) => (a.sortOrder ?? Number(a.id)) - (b.sortOrder ?? Number(b.id)) || a.name.localeCompare(b.name),
      ),
    [projects],
  );

  const carmenTasksByProject = useMemo(() => {
    const map: Record<string, typeof projectTasks> = {};
    for (const t of projectTasks) {
      if (t.status === "done") continue;
      if (bucketProjectTaskOwner(t.owner, t.title) !== "carmen") continue;
      (map[t.projectId] ??= []).push(t);
    }
    return map;
  }, [projectTasks]);

  const blockersByProject = useMemo(() => {
    const map: Record<string, typeof blockers> = {};
    for (const b of blockers) {
      (map[b.projectId] ??= []).push(b);
    }
    return map;
  }, [blockers]);

  const roseAttachments = useMemo(
    () =>
      agentWorkItems.filter(
        (w) =>
          (w.attachmentCount ?? 0) > 0 &&
          w.status !== "done" &&
          w.status !== "rejected",
      ),
    [agentWorkItems],
  );

  const totalCarmenOpen = Object.values(carmenTasksByProject).reduce((n, list) => n + list.length, 0);
  const showForRole = currentRole === "Carmen" || currentRole === "Rose" || currentRole === "Admin";

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Carmen’s path today"
        subtitle="Work order Rose set — projects in her priority order, with Carmen’s open tasks and blockers under each."
        icon={PathIcon}
        accent="violet"
      />

      {!showForRole && (
        <EmptyState message="This path view is for Rose and Carmen." hint="Use Projects and Project Tasks for the shared list." />
      )}

      {showForRole && roseAttachments.length > 0 && (
        <SectionCard title="Rose attached files" icon={ClipboardCheck} accent="rose">
          <ul className="space-y-2">
            {roseAttachments.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{w.title}</p>
                  <p className="text-xs text-slate-500">
                    {w.attachmentCount} file{w.attachmentCount === 1 ? "" : "s"} on an open Cursor request
                  </p>
                </div>
                <Link href="/agent-queue" className="text-xs font-semibold text-rose-600 hover:underline">
                  Open Cursor requests
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {showForRole && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">
            {totalCarmenOpen} open for Carmen
          </span>
          <Link href="/projects" className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline">
            <FolderKanban className="h-3.5 w-3.5" /> Edit priority on Projects
          </Link>
          <Link href="/project-tasks" className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline">
            <ListChecks className="h-3.5 w-3.5" /> Full task list
          </Link>
        </div>
      )}

      {showForRole && projectsLoading && <p className="py-8 text-center text-sm text-slate-400">Loading Carmen’s path…</p>}

      {showForRole && !projectsLoading && orderedProjects.length === 0 && (
        <EmptyState message="No projects yet." hint="Add projects, then Rose can drag them into today’s work order." />
      )}

      {showForRole &&
        !projectsLoading &&
        orderedProjects.map((p, index) => {
          const tasks = carmenTasksByProject[p.id] ?? [];
          const projectBlockers = blockersByProject[p.id] ?? [];
          return (
            <section key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-lg bg-violet-100 px-1.5 text-xs font-bold text-violet-700">
                      {index + 1}
                    </span>
                    <h2 className="text-base font-semibold text-slate-800">{p.name}</h2>
                    <StatusChip label={humanLabel(HUMAN_PROJECT_STATUS, p.status)} tone="slate" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.description}</p>
                </div>
                <Link href="/projects" className="text-xs font-semibold text-sky-600 hover:underline">
                  Open in Projects
                </Link>
              </div>

              {projectBlockers.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Blockers
                  </p>
                  <ul className="space-y-1.5">
                    {projectBlockers.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span>{b.title}</span>
                        <RiskBadge value={b.risk} />
                        {b.owner ? <span className="text-xs text-slate-400">{b.owner}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Carmen’s open tasks ({tasks.length})
                </p>
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing open for Carmen on this project.</p>
                ) : (
                  <ul className="space-y-2">
                    {tasks.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{t.title}</p>
                          <p className="text-xs text-slate-400">{t.owner ?? "Carmen"} · {t.due ? `Due ${t.due}` : "No due date"}</p>
                        </div>
                        <StatusChip label={humanLabel(HUMAN_TASK_STATUS, t.status)} tone="sky" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
    </div>
  );
}
