import { useMemo, useState, useRef } from "react";
import { Link } from "wouter";
import {
  FolderKanban,
  ArrowRight,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  Unlock,
  Save,
  GripVertical,
} from "lucide-react";
import {
  useListProjects,
  useListProjectBlockers,
  useListProjectBuildPlans,
  useListProjectHandoffs,
  updateRoseInstructions,
  updateProjectBuildPlan,
  uploadProjectHandoff,
  unblockProjectPhase,
  reorderProjects,
  getListProjectBuildPlansQueryKey,
  getListProjectHandoffsQueryKey,
  getListProjectsQueryKey,
  type ProjectBuildPlanRecord,
  type ProjectHandoffRecord,
  type ProjectRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, SectionCard, StatusChip, RiskBadge, EmptyState } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useAppState } from "@/hooks/use-app-state";
import { humanLabel, HUMAN_PROJECT_STATUS } from "@/lib/ui-labels";
import { useToast } from "@/hooks/use-toast";
import type { ProjectStatus } from "@/types";

const STATUS_TONE: Record<ProjectStatus, "sky" | "rose" | "amber" | "slate" | "emerald" | "violet"> = {
  active: "sky",
  "at-risk": "rose",
  blocked: "rose",
  stale: "amber",
  complete: "emerald",
  planning: "violet",
};

const PROJECT_TYPE_LABEL: Record<string, string> = {
  demo: "Demo",
  live: "Live app",
  planning: "Planning",
  "merged-cc-host": "Command Center",
};

const PROJECT_TYPE_TONE: Record<string, "amber" | "emerald" | "violet" | "sky"> = {
  demo: "amber",
  live: "emerald",
  planning: "violet",
  "merged-cc-host": "sky",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectDetailPanel({
  projectId,
  plan,
  handoffs,
  blockerCount,
  openTaskCount,
  isRose,
  isCarmen,
  onRefresh,
}: {
  projectId: number;
  plan: ProjectBuildPlanRecord | undefined;
  handoffs: ProjectHandoffRecord[];
  blockerCount: number;
  openTaskCount: number;
  isRose: boolean;
  isCarmen: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [roseText, setRoseText] = useState(plan?.roseInstructions ?? "");
  const [carmenSummary, setCarmenSummary] = useState(plan?.summary ?? "");
  const [carmenNotes, setCarmenNotes] = useState(plan?.carmenPlanNotes ?? "");
  const [carmenProgress, setCarmenProgress] = useState(plan?.progress ?? 0);
  const [busy, setBusy] = useState(false);

  const visibleProgress = plan?.visibleProgress ?? plan?.progress ?? 0;

  async function saveRoseInstructions() {
    setBusy(true);
    try {
      await updateRoseInstructions(projectId, { roseInstructions: roseText });
      toast({ title: "Instructions saved", description: "Your handoff brief is updated for Carmen." });
      onRefresh();
    } catch {
      toast({ title: "Could not save", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function saveBuildPlan() {
    setBusy(true);
    try {
      await updateProjectBuildPlan(projectId, {
        summary: carmenSummary,
        carmenPlanNotes: carmenNotes,
        progress: carmenProgress,
        phases: plan?.phases,
      });
      toast({ title: "Build plan saved", description: "Operational progress and notes are updated." });
      onRefresh();
    } catch {
      toast({ title: "Could not save", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock() {
    setBusy(true);
    try {
      const updated = await unblockProjectPhase(projectId);
      toast({
        title: "Next phase unlocked",
        description: `Team now sees: ${updated.currentPhaseTitle}`,
      });
      onRefresh();
    } catch {
      toast({ title: "Could not unlock phase", description: "Check that a gated phase is ready.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10 MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      await uploadProjectHandoff(projectId, {
        filename: file.name,
        contentBase64: btoa(binary),
        mimeType: file.type || undefined,
      });
      toast({ title: "File uploaded", description: file.name });
      onRefresh();
    } catch {
      toast({ title: "Upload failed", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Current phase</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{plan?.currentPhaseTitle ?? "Not set yet"}</p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Team-visible progress</p>
          <p className="mt-1 text-sm font-semibold text-sky-700">{visibleProgress}%</p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open items</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {blockerCount} blocker{blockerCount === 1 ? "" : "s"} · {openTaskCount} task{openTaskCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Rose&apos;s instructions</p>
        <p className="mt-1 text-[11px] text-slate-500">Your intent and handoff notes for this project — what Carmen should know.</p>
        {isRose ? (
          <>
            <textarea
              value={roseText}
              onChange={(e) => setRoseText(e.target.value)}
              rows={4}
              placeholder="What you want built, any client context, and what 'done' looks like..."
              className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveRoseInstructions}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Save instructions
            </button>
          </>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {plan?.roseInstructions?.trim() ? plan.roseInstructions : "Rose has not added instructions yet."}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File handoffs</p>
        <p className="mt-1 text-[11px] text-slate-400">Upload briefs, exports, or reference files for this project.</p>
        {(isRose || isCarmen) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> Upload file (max 10 MB)
            </button>
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {handoffs.length === 0 ? (
            <li className="text-sm text-slate-400">No files attached yet.</li>
          ) : (
            handoffs.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{h.filename}</span>
                <span className="text-[11px] text-slate-400">
                  {formatBytes(h.sizeBytes)} · {h.uploadedBy} · {new Date(h.uploadedAt).toLocaleDateString()}
                </span>
                <a
                  href={`/api/projects/${projectId}/handoffs/${h.id}/download`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </li>
            ))
          )}
        </ul>
      </div>

      {isRose && plan?.canUnblock ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Phase gate</p>
          <p className="mt-1 text-sm text-slate-600">
            Unlock the next phase for the team without changing Carmen&apos;s internal build progress.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleUnblock}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Unlock className="h-4 w-4" /> Unblock next phase
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Build plan</p>
        <p className="mt-1 text-[11px] text-slate-500">Carmen&apos;s operational truth — phases, internal progress, and blockers.</p>
        {isCarmen ? (
          <div className="mt-3 space-y-3">
            <label className="block text-[11px] font-semibold text-slate-500">
              Summary
              <input
                value={carmenSummary}
                onChange={(e) => setCarmenSummary(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-500">
              Internal progress ({carmenProgress}%)
              <input
                type="range"
                min={0}
                max={100}
                value={carmenProgress}
                onChange={(e) => setCarmenProgress(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-500">
              Carmen&apos;s notes
              <textarea
                value={carmenNotes}
                onChange={(e) => setCarmenNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
            {plan?.phases?.length ? (
              <ul className="space-y-1 text-xs text-slate-600">
                {plan.phases.map((ph) => (
                  <li key={ph.id} className="flex justify-between rounded-lg bg-white/80 px-2 py-1">
                    <span>{ph.title}</span>
                    <span className="font-medium capitalize text-slate-500">{ph.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={saveBuildPlan}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Save build plan
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>{plan?.summary ?? "No build plan yet."}</p>
            {plan?.carmenPlanNotes ? <p className="text-slate-500">{plan.carmenPlanNotes}</p> : null}
            <p className="text-xs text-slate-400">Internal progress: {plan?.progress ?? 0}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { projectTasks, projectsLoading } = useAppState();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: projects = [], isLoading: apiProjectsLoading } = useListProjects();
  const { data: blockers = [] } = useListProjectBlockers();
  const { data: buildPlans = [], isLoading: plansLoading } = useListProjectBuildPlans();
  const { data: handoffs = [] } = useListProjectHandoffs();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [ordered, setOrdered] = useState<ProjectRecord[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const role = user?.role ?? "";
  const isRose = role === "rose_admin" || role === "super_admin";
  const isCarmen = role === "carmen_admin" || role === "super_admin";
  const canReorder = isRose || isCarmen;

  const planByProject = useMemo(
    () => Object.fromEntries(buildPlans.map((p) => [p.projectId, p])),
    [buildPlans],
  );
  const handoffsByProject = useMemo(() => {
    const map: Record<number, ProjectHandoffRecord[]> = {};
    for (const h of handoffs) {
      (map[h.projectId] ??= []).push(h);
    }
    return map;
  }, [handoffs]);
  const openTaskCountByProject = useMemo(
    () =>
      Object.fromEntries(
        projects.map((p) => [
          p.id,
          projectTasks.filter((t) => t.projectId === String(p.id) && t.status !== "done").length,
        ]),
      ),
    [projects, projectTasks],
  );
  const blockerCountByProject = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, blockers.filter((b) => b.projectId === p.id).length])),
    [projects, blockers],
  );

  function refreshPlans() {
    void queryClient.invalidateQueries({ queryKey: getListProjectBuildPlansQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListProjectHandoffsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  }

  // Priority order from API (sortOrder). Local drag state overlays until save completes.
  const sorted = useMemo(() => {
    if (ordered) return ordered;
    return [...projects].sort(
      (a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id) || a.name.localeCompare(b.name),
    );
  }, [projects, ordered]);

  async function persistOrder(next: ProjectRecord[]) {
    setSavingOrder(true);
    try {
      const updated = await reorderProjects({ orderedIds: next.map((p) => p.id) });
      setOrdered(updated);
      void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "Priority order saved", description: "Carmen will see this as her work path." });
    } catch {
      setOrdered(null);
      toast({ title: "Could not save order", description: "Try dragging again.", variant: "destructive" });
    } finally {
      setSavingOrder(false);
    }
  }

  function onDragStart(id: number) {
    if (!canReorder || savingOrder) return;
    setDragId(id);
  }

  function onDragOver(e: React.DragEvent, overId: number) {
    e.preventDefault();
    if (!canReorder || dragId === null || dragId === overId) return;
    const list = [...sorted];
    const from = list.findIndex((p) => p.id === dragId);
    const to = list.findIndex((p) => p.id === overId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item!);
    setOrdered(list);
  }

  function onDragEnd() {
    if (!canReorder || dragId === null) {
      setDragId(null);
      return;
    }
    setDragId(null);
    if (ordered) void persistOrder(ordered);
  }

  const loading = projectsLoading || apiProjectsLoading || plansLoading;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Projects"
        subtitle="Where each app stands — Rose's direction, Carmen's build plan, blockers, and handoff files."
        icon={FolderKanban}
        accent="sky"
      />
      <p className="-mt-4 text-xs text-slate-400">
        Registry health refreshes overnight. Build plans and Rose instructions stay until you change them.
        {projects.some((p) => p.lastSyncedAt)
          ? ` Last registry sync: ${new Date(
              Math.max(...projects.map((p) => (p.lastSyncedAt ? Date.parse(p.lastSyncedAt) : 0))),
            ).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
          : null}
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading projects…</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-500">Demo apps</p>
              <p className="mt-1 text-2xl font-bold text-sky-700">
                {projects.filter((p) => p.projectType === "demo").length}
              </p>
            </div>
          </div>

          <SectionCard title="All Projects" icon={FolderKanban} accent="blue">
            {canReorder ? (
              <p className="mb-3 text-xs text-slate-500">
                {isRose
                  ? "Drag to set Carmen’s work order · Priority order (Rose sets this)"
                  : "Drag to set Carmen’s work order · You and Rose can reorder this list"}
                {savingOrder ? " · Saving…" : null}
              </p>
            ) : (
              <p className="mb-3 text-xs text-slate-500">Priority order (Rose sets this) — top of the list is Carmen’s next focus.</p>
            )}
            <ul className="space-y-3">
              {sorted.map((p, index) => {
                const plan = planByProject[p.id];
                const displayProgress = plan?.visibleProgress ?? p.progress;
                const expanded = expandedId === p.id;
                return (
                  <li
                    key={p.id}
                    draggable={canReorder}
                    onDragStart={() => onDragStart(p.id)}
                    onDragOver={(e) => onDragOver(e, p.id)}
                    onDragEnd={onDragEnd}
                    className={`rounded-xl border border-slate-100 bg-slate-50/40 p-4 ${canReorder ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === p.id ? "opacity-60 ring-2 ring-sky-300" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-2">
                        {canReorder ? (
                          <span className="mt-0.5 shrink-0 text-slate-300" title="Drag to reorder" aria-hidden>
                            <GripVertical className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-slate-200/80 px-1.5 text-[10px] font-bold text-slate-600">
                              {index + 1}
                            </span>
                            <h3 className="text-sm font-semibold text-slate-800">{p.name}</h3>
                            <StatusChip label={humanLabel(HUMAN_PROJECT_STATUS, p.status)} tone={STATUS_TONE[p.status]} />
                            {p.projectType ? (
                              <StatusChip
                                label={PROJECT_TYPE_LABEL[p.projectType] ?? p.projectType}
                                tone={PROJECT_TYPE_TONE[p.projectType] ?? "slate"}
                              />
                            ) : null}
                            <RiskBadge value={p.risk} />
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                            <span>{p.department}</span>
                            <span>{p.owner ?? "Unassigned"}</span>
                            {plan?.currentPhaseTitle ? <span>Phase: {plan.currentPhaseTitle}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">{displayProgress}%</p>
                          <p className="text-[10px] text-slate-400">team progress</p>
                        </div>
                        <Link
                          href="/project-tasks"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          {openTaskCountByProject[p.id] ?? 0} open task{(openTaskCountByProject[p.id] ?? 0) === 1 ? "" : "s"}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : p.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-sky-600"
                        >
                          {expanded ? (
                            <>
                              Hide details <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              View plan & handoffs <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                        style={{ width: `${displayProgress}%` }}
                      />
                    </div>
                    {(blockerCountByProject[p.id] ?? 0) > 0 ? (
                      <p className="mt-2 text-xs font-medium text-rose-600">
                        {blockerCountByProject[p.id]} blocker{(blockerCountByProject[p.id] ?? 0) === 1 ? "" : "s"} tracked
                      </p>
                    ) : null}
                    {expanded ? (
                      <ProjectDetailPanel
                        projectId={p.id}
                        plan={plan}
                        handoffs={handoffsByProject[p.id] ?? []}
                        blockerCount={blockerCountByProject[p.id] ?? 0}
                        openTaskCount={openTaskCountByProject[p.id] ?? 0}
                        isRose={isRose}
                        isCarmen={isCarmen}
                        onRefresh={refreshPlans}
                      />
                    ) : null}
                  </li>
                );
              })}
              {sorted.length === 0 ? (
                <li>
                  <EmptyState
                    message="No projects yet."
                    hint="Projects appear after the overnight registry sync, or when you add them here."
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
