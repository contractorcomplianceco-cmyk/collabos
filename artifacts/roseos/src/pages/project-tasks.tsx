import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { ClipboardCheck, FolderKanban, Plus, Check, Users } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { canSubmit } from "@/lib/helpers";
import {
  bucketProjectTaskOwner,
  formatProjectTaskCompletedDate,
  projectTaskCompletedSortKey,
} from "@/lib/project-task-owners";
import { getStickyFilter, setStickyFilter } from "@/lib/nav-prefs";
import { useToast } from "@/hooks/use-toast";
import { humanLabel, HUMAN_TASK_STATUS } from "@/lib/ui-labels";
import type { Task } from "@/types";

const TASK_TONE: Record<Task["status"], "slate" | "sky" | "amber" | "emerald"> = {
  todo: "slate",
  "in-progress": "sky",
  review: "amber",
  done: "emerald",
};

const STATUSES: Task["status"][] = ["todo", "in-progress", "review", "done"];
const OWNER_FILTERS = ["all", "rose", "carmen", "team"] as const;

export default function ProjectTasksPage() {
  const { projectTasks, projects, projectsLoading, currentRole, createProjectTaskEntry, updateProjectTaskEntry } = useAppState();
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const userKey = user?.email ?? String(user?.id ?? currentRole);
  const projectsByPriority = [...projects].sort(
    (a, b) => (a.sortOrder ?? Number(a.id)) - (b.sortOrder ?? Number(b.id)) || a.name.localeCompare(b.name),
  );
  const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const projectOrderById = Object.fromEntries(projects.map((p) => [p.id, p.sortOrder ?? Number(p.id)]));
  const canEdit = canSubmit(currentRole);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editStatus, setEditStatus] = useState<Task["status"]>("todo");
  const [projectFilter, setProjectFilter] = useState(() => getStickyFilter(userKey, "project-tasks-project") || "all");
  const [ownerFilter, setOwnerFilter] = useState<(typeof OWNER_FILTERS)[number]>(() => {
    const saved = getStickyFilter(userKey, "project-tasks-owner");
    return (OWNER_FILTERS as readonly string[]).includes(saved) ? (saved as (typeof OWNER_FILTERS)[number]) : "all";
  });
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const task = params.get("task");
    const project = params.get("project");
    if (task) setFocusTaskId(task);
    if (project) {
      setProjectFilter(project);
      setStickyFilter(userKey, "project-tasks-project", project);
    }
  }, [search, userKey]);

  const chooseProjectFilter = (id: string) => {
    setProjectFilter(id);
    setStickyFilter(userKey, "project-tasks-project", id);
  };
  const chooseOwnerFilter = (o: (typeof OWNER_FILTERS)[number]) => {
    setOwnerFilter(o);
    setStickyFilter(userKey, "project-tasks-owner", o);
  };

  const byProjectPriority = (a: Task, b: Task) =>
    (projectOrderById[a.projectId] ?? Number.MAX_SAFE_INTEGER) - (projectOrderById[b.projectId] ?? Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title);

  const matchesFilters = (t: Task) => {
    if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
    if (ownerFilter === "all") return true;
    return bucketProjectTaskOwner(t.owner, t.title) === ownerFilter;
  };

  const openTasks = projectTasks.filter((t) => t.status !== "done" && matchesFilters(t));
  const roseOpen = openTasks.filter((t) => bucketProjectTaskOwner(t.owner, t.title) === "rose").sort(byProjectPriority);
  const carmenOpen = openTasks.filter((t) => bucketProjectTaskOwner(t.owner, t.title) === "carmen").sort(byProjectPriority);
  const teamOpen = openTasks.filter((t) => bucketProjectTaskOwner(t.owner, t.title) === "team").sort(byProjectPriority);
  const doneTasks = projectTasks
    .filter((t) => t.status === "done" && matchesFilters(t))
    .slice()
    .sort((a, b) => projectTaskCompletedSortKey(b) - projectTaskCompletedSortKey(a));

  const submitNew = async () => {
    if (!title.trim() || !projectId) {
      toast({ title: "Missing fields", description: "Task title and project are required." });
      return;
    }
    await createProjectTaskEntry({
      title: title.trim(),
      projectId,
      owner: owner.trim() || null,
      due: due.trim() || null,
    });
    setTitle("");
    setOwner("");
    setDue("");
    setShowForm(false);
    toast({ title: "Task created", description: "Your task is saved — overnight server updates won't remove it." });
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditOwner(task.owner ?? "");
    setEditDue(task.due ?? "");
    setEditStatus(task.status);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;
    await updateProjectTaskEntry(editingId, {
      title: editTitle.trim(),
      owner: editOwner.trim() || null,
      due: editDue.trim() || null,
      status: editStatus,
    });
    setEditingId(null);
    toast({ title: "Task updated" });
  };

  const markDone = async (task: Task) => {
    await updateProjectTaskEntry(task.id, { status: "done" });
    toast({ title: "Task completed" });
  };

  const renderTask = (task: Task, opts?: { showCompletedDate?: boolean }) => {
    if (editingId === task.id) {
      return (
        <li key={task.id} className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="field-input w-full text-sm" />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" className="field-input text-sm" />
            <input value={editDue} onChange={(e) => setEditDue(e.target.value)} placeholder="Due date" className="field-input text-sm" />
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Task["status"])} className="field-input text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{humanLabel(HUMAN_TASK_STATUS, s)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void saveEdit()} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
            <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancel</button>
          </div>
        </li>
      );
    }

    const completedLabel = opts?.showCompletedDate ? formatProjectTaskCompletedDate(task) : null;
    const focused = focusTaskId === task.id;

    return (
      <li
        key={task.id}
        id={`task-${task.id}`}
        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
          focused ? "border-sky-300 bg-sky-50/50 ring-2 ring-sky-100" : "border-slate-100"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{task.title}</p>
          <p className="truncate text-[11px] text-slate-400">
            {projectNameById[task.projectId] ?? "Project"} · {task.owner ?? "Unassigned"}
            {task.due ? ` · due ${task.due}` : ""}
            {completedLabel ? ` · completed ${completedLabel}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusChip label={humanLabel(HUMAN_TASK_STATUS, task.status)} tone={TASK_TONE[task.status]} />
          {canEdit && task.status !== "done" ? (
            <>
              <button onClick={() => void markDone(task)} title="Mark complete" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
              <button onClick={() => startEdit(task)} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-sky-600 hover:bg-sky-50">Edit</button>
            </>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Project Tasks"
        subtitle="Open follow-ups in Carmen’s project priority order (set on Projects), grouped by owner."
        icon={ClipboardCheck}
        accent="sky"
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">
                <Plus className="h-3.5 w-3.5" /> New task
              </button>
            ) : null}
            <Link href="/projects" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-600">
              <FolderKanban className="h-3.5 w-3.5" /> All projects
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Project</label>
        <select
          value={projectFilter}
          onChange={(e) => chooseProjectFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
        >
          <option value="all">All projects</option>
          {projectsByPriority.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Owner</label>
        {OWNER_FILTERS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => chooseOwnerFilter(o)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              ownerFilter === o ? "bg-sky-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {o === "all" ? "All owners" : o}
          </button>
        ))}
        {(projectFilter !== "all" || ownerFilter !== "all") ? (
          <span className="text-[10px] text-slate-400">Filters remembered for you</span>
        ) : null}
      </div>

      {projects.length === 0 && !projectsLoading ? (
        <EmptyState
          message="No projects yet."
          hint="Projects appear after overnight server updates, or when you add them on the Projects page."
          action={<Link href="/projects" className="text-xs font-semibold text-sky-600 hover:underline">View Projects</Link>}
        />
      ) : null}

      {showForm && canEdit ? (
        <SectionCard title="New Task" icon={Plus} accent="sky">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="field-input sm:col-span-2" />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field-input">
              <option value="">Select project…</option>
              {projectsByPriority.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner (Rose, Carmen, or team)" className="field-input" />
            <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Due date (optional)" className="field-input sm:col-span-2" />
          </div>
          <button onClick={() => void submitNew()} className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Create task</button>
        </SectionCard>
      ) : null}

      {projectsLoading ? (
        <p className="text-sm text-slate-500">Loading project tasks…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard title={`Rose’s open work (${roseOpen.length})`} icon={ClipboardCheck} accent="rose">
              <ul className="space-y-2">
                {roseOpen.map((t) => renderTask(t))}
                {roseOpen.length === 0 ? (
                  <li>
                    <EmptyState message="No open work for Rose." hint="Tasks owned by Rose appear here." />
                  </li>
                ) : null}
              </ul>
            </SectionCard>

            <SectionCard title={`Carmen’s open work (${carmenOpen.length})`} icon={ClipboardCheck} accent="violet">
              <ul className="space-y-2">
                {carmenOpen.map((t) => renderTask(t))}
                {carmenOpen.length === 0 ? (
                  <li>
                    <EmptyState
                      message="No open work for Carmen."
                      hint="Sign-offs from Review Queue land here. Or add a task manually."
                      action={
                        <div className="flex flex-wrap justify-center gap-2">
                          <Link href="/carmen-path" className="text-xs font-semibold text-violet-600 hover:underline">Carmen’s path today</Link>
                          <Link href="/review-queue" className="text-xs font-semibold text-rose-600 hover:underline">Review Queue</Link>
                        </div>
                      }
                    />
                  </li>
                ) : null}
              </ul>
            </SectionCard>

            <SectionCard title={`Open — Team / unassigned (${teamOpen.length})`} icon={Users} accent="sky">
              <ul className="space-y-2">
                {teamOpen.map((t) => renderTask(t))}
                {teamOpen.length === 0 ? (
                  <li>
                    <EmptyState message="No team or unassigned tasks." hint="Tasks without a Rose/Carmen owner land here so nothing is hidden." />
                  </li>
                ) : null}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title={`Completed history (${doneTasks.length})`} icon={ClipboardCheck} accent="emerald">
            <ul className="space-y-2">
              {doneTasks.map((t) => renderTask(t, { showCompletedDate: true }))}
              {doneTasks.length === 0 ? (
                <li>
                  <EmptyState message="No completed tasks yet." hint="Finished tasks stay here newest-first so you can look back." />
                </li>
              ) : null}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
