#!/usr/bin/env node
/**
 * Backfill honest build plans for all projects (v2 schema).
 * Truncates sync-sourced plans and re-derives from project status/blockers/tags.
 */
import pg from "/home/ubuntu/projects/collabos/lib/db/node_modules/pg/lib/index.js";

const LOG_PREFIX = () => `[${new Date().toISOString()}]`;

function log(msg) {
  console.log(`${LOG_PREFIX()} ${msg}`);
}

const STANDARD_LIVE_PHASES = [
  { id: "phase-1", title: "Planning & setup", status: "locked" },
  { id: "phase-2", title: "Build in progress", status: "locked" },
  { id: "phase-3", title: "Live & stable", status: "locked" },
];

const DEMO_PHASES = [{ id: "demo", title: "Demo — not in production", status: "active", visibleProgress: 100 }];

const MERGED_CC_PHASES = [
  { id: "cc-1", title: "Merged into Command Center", status: "complete", visibleProgress: 100 },
  { id: "cc-2", title: "Maintenance mode", status: "active", visibleProgress: 90 },
];

function isCommandCenterHosted(project) {
  if (project.source === "Command Center") return true;
  return (project.tags ?? []).some(
    (t) => t === "command-center-hosted" || t.startsWith("cockpit-") || t === "command.cagteam.net",
  );
}

function inferProjectType(project) {
  if (isCommandCenterHosted(project)) return "merged-cc-host";
  const tags = project.tags ?? [];
  if (tags.includes("demo") || tags.some((t) => t.includes("demo."))) return "demo";
  if (project.status === "planning" || tags.includes("source-only") || tags.includes("archive")) {
    return "planning";
  }
  return "live";
}

function withLivePhaseStatuses(activeIndex, blocked) {
  return STANDARD_LIVE_PHASES.map((phase, index) => {
    let status = "locked";
    if (index < activeIndex) status = "complete";
    else if (index === activeIndex) status = blocked ? "locked" : "active";
    return { ...phase, status, visibleProgress: status === "complete" ? 100 : undefined };
  });
}

function derivePlan(project, blockers) {
  const projectType = inferProjectType(project);
  const hasBlockers = blockers.length > 0;
  const blockedStatus = project.status === "blocked" || (hasBlockers && project.status !== "complete");

  if (projectType === "merged-cc-host") {
    return {
      projectType,
      summary: "Runs inside Command Center — standalone domain retired",
      currentPhaseId: "cc-2",
      progress: project.status === "blocked" || project.status === "at-risk" ? 60 : 90,
      phases: MERGED_CC_PHASES.map((p) => ({ ...p })),
      carmenPlanNotes:
        "Hosted in Command Center — maintenance mode. Standalone domain retired; module runs inside Command Center.",
    };
  }

  if (projectType === "demo") {
    return {
      projectType,
      summary: "Demo or preview — not a production app yet",
      currentPhaseId: "demo",
      progress: Math.min(Math.max(project.progress ?? 40, 40), 100),
      phases: DEMO_PHASES.map((p) => ({ ...p })),
      carmenPlanNotes: "",
    };
  }

  if (project.status === "complete") {
    const phases = withLivePhaseStatuses(2, false).map((p) => ({ ...p, status: "complete", visibleProgress: 100 }));
    return {
      projectType,
      summary: "Shipped and marked complete",
      currentPhaseId: "phase-3",
      progress: Math.max(project.progress ?? 100, 100),
      phases,
      carmenPlanNotes: "",
    };
  }

  if (blockedStatus) {
    return {
      projectType,
      summary: hasBlockers ? "Blocked — see open blockers below" : "Blocked — needs attention",
      currentPhaseId: "phase-2",
      progress: Math.min(Math.max(project.progress ?? 10, 10), 70),
      phases: withLivePhaseStatuses(1, true),
      carmenPlanNotes: "",
    };
  }

  if (project.status === "planning" || projectType === "planning") {
    return {
      projectType,
      summary: "Still in planning — not in active build yet",
      currentPhaseId: "phase-1",
      progress: Math.min(Math.max(project.progress ?? 5, 5), 25),
      phases: withLivePhaseStatuses(0, false),
      carmenPlanNotes: "",
    };
  }

  return {
    projectType,
    summary: project.status === "active" ? "In progress — actively being built" : "In progress — needs follow-up",
    currentPhaseId: "phase-2",
    progress: Math.min(Math.max(project.progress ?? 20, 20), 95),
    phases: withLivePhaseStatuses(1, false),
    carmenPlanNotes: "",
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("ERROR DATABASE_URL not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows: projects } = await client.query(
    "SELECT id, name, status, progress, source, tags FROM projects ORDER BY id",
  );
  const { rows: allBlockers } = await client.query("SELECT project_id, title FROM project_blockers");
  const blockersByProject = new Map();
  for (const b of allBlockers) {
    const list = blockersByProject.get(b.project_id) ?? [];
    list.push(b);
    blockersByProject.set(b.project_id, list);
  }

  await client.query("DELETE FROM project_build_plans WHERE source = 'sync'");

  let created = 0;
  let skippedManual = 0;

  for (const project of projects) {
    const { rows: existing } = await client.query(
      "SELECT id, source FROM project_build_plans WHERE project_id = $1",
      [project.id],
    );
    if (existing[0]?.source === "manual") {
      skippedManual++;
      continue;
    }
    if (existing.length > 0) {
      await client.query("DELETE FROM project_build_plans WHERE project_id = $1", [project.id]);
    }

    const blockers = blockersByProject.get(project.id) ?? [];
    const plan = derivePlan(project, blockers);
    await client.query(
      `INSERT INTO project_build_plans
        (project_id, summary, current_phase_id, progress, phases, rose_instructions, carmen_plan_notes, source)
       VALUES ($1, $2, $3, $4, $5::jsonb, '', $6, 'sync')`,
      [project.id, plan.summary, plan.currentPhaseId, plan.progress, JSON.stringify(plan.phases), plan.carmenPlanNotes],
    );
    await client.query("UPDATE projects SET project_type = $1 WHERE id = $2", [plan.projectType, project.id]);
    created++;
    log(`  ${project.name}: ${plan.progress}% (${plan.currentPhaseId}) [${plan.projectType}]`);
  }

  await client.end();
  log(`backfill complete: ${created} created/updated, ${skippedManual} manual kept, ${projects.length} total`);
}

main().catch((err) => {
  log(`ERROR ${err.message}`);
  process.exit(1);
});
