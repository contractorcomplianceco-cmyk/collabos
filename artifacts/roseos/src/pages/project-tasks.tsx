import { useState } from "react";
import { Link } from "wouter";
import { ClipboardCheck, FolderKanban, Plus, Check } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canSubmit } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@/types";

const TASK_TONE: Record<Task["status"], "slate" | "sky" | "amber" | "emerald"> = {
  todo: "slate",
  "in-progress": "sky",
  review: "amber",
  done: "emerald",
};

const STATUSES: Task["status"][] = ["todo", "in-progress", "review", "done"];

export default function ProjectTasksPage() {
  const { projectTasks, projects, projectsLoading, currentRole, createProjectTaskEntry, updateProjectTaskEntry } = useAppState();
  const { toast } = useToast();
  const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));
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

  const openTasks = projectTasks.filter((t) => t.status !== "done");
  const doneTasks = projectTasks.filter((t) => t.status === "done");

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
    toast({ title: "Task created", description: "Manual tasks are kept across nightly project sync." });
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

  const renderTask = (task: Task) => {
    if (editingId === task.id) {
      return (
        <li key={task.id} className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="field-input w-full text-sm" />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" className="field-input text-sm" />
            <input value={editDue} onChange={(e) => setEditDue(e.target.value)} placeholder="Due date" className="field-input text-sm" />
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Task["status"])} className="field-input text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/-/g, " ")}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void saveEdit()} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white">Save</button>
            <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancel</button>
          </div>
        </li>
      );
    }

    return (
      <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{task.title}</p>
          <p className="truncate text-[11px] text-slate-400">
            {projectNameById[task.projectId] ?? "Project"} · {task.owner ?? "Unassigned"}
            {task.due ? ` · due ${task.due}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusChip label={task.status.replace(/-/g, " ")} tone={TASK_TONE[task.status]} />
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
        subtitle="Manual follow-up tasks tied to projects — nightly sync updates project status, not your tasks."
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

      {projects.length === 0 && !projectsLoading ? (
        <EmptyState
          message="No projects in the registry yet."
          hint="Projects appear after the nightly sync discovers repos and services, or when you add them manually."
          action={<Link href="/projects" className="text-xs font-semibold text-sky-600 hover:underline">View Projects</Link>}
        />
      ) : null}

      {showForm && canEdit ? (
        <SectionCard title="New Task" icon={Plus} accent="sky">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="field-input sm:col-span-2" />
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="field-input">
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner (optional)" className="field-input" />
            <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="Due date (optional)" className="field-input sm:col-span-2" />
          </div>
          <button onClick={() => void submitNew()} className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Create task</button>
        </SectionCard>
      ) : null}

      {projectsLoading ? (
        <p className="text-sm text-slate-500">Loading project tasks…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title={`Open Tasks (${openTasks.length})`} icon={ClipboardCheck} accent="sky">
            <ul className="space-y-2">
              {openTasks.map(renderTask)}
              {openTasks.length === 0 ? (
                <li>
                  <EmptyState
                    message="No open project tasks yet."
                    hint={canEdit ? "Create a task above to track follow-up work on any project." : "Tasks you can view will appear here when teammates add them."}
                  />
                </li>
              ) : null}
            </ul>
          </SectionCard>

          <SectionCard title={`Completed (${doneTasks.length})`} icon={ClipboardCheck} accent="emerald">
            <ul className="space-y-2">
              {doneTasks.map(renderTask)}
              {doneTasks.length === 0 ? (
                <li>
                  <EmptyState message="No completed tasks yet." hint="Completed tasks stay visible for audit context." />
                </li>
              ) : null}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
