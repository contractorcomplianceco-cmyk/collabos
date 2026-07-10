import {
  type BlockerRow,
  type BuildPlanPhaseItem,
  type ProjectBuildPlanRow,
  type ProjectRow,
  type ProjectType,
} from "@workspace/db";

export const STANDARD_LIVE_PHASES: BuildPlanPhaseItem[] = [
  { id: "phase-1", title: "Planning & setup", status: "locked" },
  { id: "phase-2", title: "Build in progress", status: "locked" },
  { id: "phase-3", title: "Live & stable", status: "locked" },
];

export const DEMO_PHASES: BuildPlanPhaseItem[] = [
  { id: "demo", title: "Demo — not in production", status: "active", visibleProgress: 100 },
];

export const MERGED_CC_PHASES: BuildPlanPhaseItem[] = [
  { id: "cc-1", title: "Merged into Command Center", status: "complete", visibleProgress: 100 },
  { id: "cc-2", title: "Maintenance mode", status: "active", visibleProgress: 90 },
];

export function isCommandCenterHosted(project: Pick<ProjectRow, "source" | "tags">): boolean {
  if (project.source === "Command Center") return true;
  return (project.tags ?? []).some(
    (t) => t === "command-center-hosted" || t.startsWith("cockpit-") || t === "command.cagteam.net",
  );
}

export function inferProjectType(project: Pick<ProjectRow, "source" | "tags" | "status">): ProjectType {
  if (isCommandCenterHosted(project)) return "merged-cc-host";
  const tags = project.tags ?? [];
  if (tags.includes("demo") || tags.some((t) => t.includes("demo."))) return "demo";
  if (project.status === "planning" || tags.includes("source-only") || tags.includes("archive")) {
    return "planning";
  }
  return "live";
}

export function activePhaseTitle(phases: BuildPlanPhaseItem[]): string {
  const active = phases.find((p) => p.status === "active");
  if (active) return active.title;
  const complete = [...phases].reverse().find((p) => p.status === "complete");
  return complete?.title ?? "Not started";
}

export function visibleProgressFromPhases(phases: BuildPlanPhaseItem[], fallback: number): number {
  const active = phases.find((p) => p.status === "active");
  if (active?.visibleProgress != null) return active.visibleProgress;
  const completed = phases.filter((p) => p.status === "complete");
  if (completed.length === phases.length && phases.length > 0) return 100;
  if (completed.length > 0) {
    return Math.round((completed.length / phases.length) * 100);
  }
  return fallback;
}

function withLivePhaseStatuses(activeIndex: number, blocked: boolean): BuildPlanPhaseItem[] {
  return STANDARD_LIVE_PHASES.map((phase, index) => {
    let status: BuildPlanPhaseItem["status"] = "locked";
    if (index < activeIndex) status = "complete";
    else if (index === activeIndex) status = blocked ? "locked" : "active";
    return {
      ...phase,
      status,
      visibleProgress:
        status === "complete" ? 100 : status === "active" ? undefined : undefined,
    };
  });
}

export function deriveBuildPlanFromProject(
  project: ProjectRow,
  blockers: BlockerRow[] = [],
): Omit<ProjectBuildPlanRow, "id" | "projectId" | "createdAt" | "updatedAt" | "updatedBy" | "roseInstructions"> {
  const projectType = project.projectType ?? inferProjectType(project);
  const hasBlockers = blockers.length > 0;
  const blockedStatus = project.status === "blocked" || (hasBlockers && project.status !== "complete");

  if (projectType === "merged-cc-host") {
    const phases = MERGED_CC_PHASES.map((p) => ({ ...p }));
    return {
      summary: "Runs inside Command Center — standalone domain retired",
      currentPhaseId: "cc-2",
      progress: project.status === "blocked" || project.status === "at-risk" ? 60 : 90,
      phases,
      carmenPlanNotes:
        "Hosted in Command Center. Carmen maintains the module; registry sync tracks health only.",
      source: "sync",
    };
  }

  if (projectType === "demo") {
    return {
      summary: "Demo or preview — not a production app yet",
      currentPhaseId: "demo",
      progress: Math.min(Math.max(project.progress, 40), 100),
      phases: DEMO_PHASES.map((p) => ({ ...p })),
      carmenPlanNotes: "",
      source: "sync",
    };
  }

  if (project.status === "complete") {
    const phases = withLivePhaseStatuses(2, false).map((p) =>
      p.id === "phase-3" ? { ...p, status: "complete" as const, visibleProgress: 100 } : { ...p, status: "complete" as const, visibleProgress: 100 },
    );
    return {
      summary: "Shipped and marked complete",
      currentPhaseId: "phase-3",
      progress: Math.max(project.progress, 100),
      phases,
      carmenPlanNotes: "",
      source: "sync",
    };
  }

  if (blockedStatus) {
    const phases = withLivePhaseStatuses(1, true);
    return {
      summary: hasBlockers ? "Blocked — see open blockers below" : "Blocked — needs attention",
      currentPhaseId: "phase-2",
      progress: Math.min(Math.max(project.progress, 10), 70),
      phases,
      carmenPlanNotes: "",
      source: "sync",
    };
  }

  if (project.status === "planning" || projectType === "planning") {
    const phases = withLivePhaseStatuses(0, false);
    return {
      summary: "Still in planning — not in active build yet",
      currentPhaseId: "phase-1",
      progress: Math.min(Math.max(project.progress, 5), 25),
      phases,
      carmenPlanNotes: "",
      source: "sync",
    };
  }

  const progress = Math.min(Math.max(project.progress, 20), 95);
  const phases = withLivePhaseStatuses(1, false);
  return {
    summary: project.status === "active" ? "In progress — actively being built" : "In progress — needs follow-up",
    currentPhaseId: "phase-2",
    progress,
    phases,
    carmenPlanNotes: "",
    source: "sync",
  };
}

export function canUnblockNextPhase(phases: BuildPlanPhaseItem[]): boolean {
  const activeIndex = phases.findIndex((p) => p.status === "active");
  if (activeIndex < 0) return false;
  return phases.slice(activeIndex + 1).some((p) => p.status === "locked");
}

export function unblockNextPhase(phases: BuildPlanPhaseItem[]): BuildPlanPhaseItem[] {
  const next = phases.map((p) => ({ ...p }));
  const activeIndex = next.findIndex((p) => p.status === "active");
  if (activeIndex < 0) return next;
  const lockedIndex = next.findIndex((p, i) => i > activeIndex && p.status === "locked");
  if (lockedIndex < 0) return next;
  next[activeIndex] = {
    ...next[activeIndex]!,
    status: "complete",
    visibleProgress: next[activeIndex]!.visibleProgress ?? 100,
  };
  next[lockedIndex] = {
    ...next[lockedIndex]!,
    status: "active",
  };
  return next;
}

export function serializeBuildPlan(row: ProjectBuildPlanRow) {
  const visibleProgress = visibleProgressFromPhases(row.phases, row.progress);
  return {
    id: row.id,
    projectId: row.projectId,
    summary: row.summary,
    currentPhaseId: row.currentPhaseId,
    currentPhaseTitle: activePhaseTitle(row.phases),
    progress: row.progress,
    visibleProgress,
    phases: row.phases,
    roseInstructions: row.roseInstructions,
    carmenPlanNotes: row.carmenPlanNotes,
    source: row.source,
    updatedBy: row.updatedBy,
    canUnblock: canUnblockNextPhase(row.phases),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeHandoff(row: {
  id: number;
  projectId: number;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.createdAt.toISOString(),
  };
}

export function isRoseRole(role: string): boolean {
  return role === "rose_admin" || role === "super_admin";
}

export function isCarmenRole(role: string): boolean {
  return role === "carmen_admin" || role === "super_admin";
}

export function isPlanEditor(role: string): boolean {
  return isRoseRole(role) || isCarmenRole(role);
}
