import { Router, type IRouter } from "express";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import {
  db,
  blockersTable,
  projectsTable,
  projectBuildPlansTable,
  projectHandoffsTable,
  PROJECT_TYPES,
  PROJECT_STAGES,
  PROJECT_FINAL_INTENTIONS,
  PROJECT_CONFIDENCE,
  PROJECT_PRIORITIES,
  PROJECT_SOURCE_OF_TRUTH,
  PROJECT_AGREEMENT_STATUSES,
  type BuildPlanPhaseItem,
  type ProjectType,
} from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import {
  deriveBuildPlanFromProject,
  isCarmenRole,
  isPlanEditor,
  isRoseRole,
  serializeBuildPlan,
  serializeHandoff,
  unblockNextPhase,
  inferProjectType,
} from "../lib/build-plans";
import { hasPermission } from "../lib/permissions";
import { serializeBlocker, serializeProject } from "../lib/seed-projects";
import { logAudit } from "../lib/audit";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const UPLOAD_ROOT = "/var/collabos/uploads/projects";
const MAX_HANDOFF_BYTES = 10 * 1024 * 1024;

function requireDashboard(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view projects" });
    return;
  }
  next();
}

async function getProjectOr404(id: number, res: Parameters<typeof requireAuth>[1]) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  return project;
}

router.get("/projects", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(projectsTable).orderBy(asc(projectsTable.sortOrder), asc(projectsTable.name));
  res.json(rows.map(serializeProject));
});

router.post("/projects/reorder", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can reorder projects" });
    return;
  }
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
    : [];
  if (orderedIds.length === 0) {
    res.status(400).json({ message: "orderedIds is required" });
    return;
  }

  const existing = await db.select({ id: projectsTable.id }).from(projectsTable);
  const existingIds = new Set(existing.map((r) => r.id));
  if (orderedIds.some((id: number) => !existingIds.has(id))) {
    res.status(400).json({ message: "One or more project ids are invalid" });
    return;
  }

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(projectsTable)
      .set({ sortOrder: i + 1 })
      .where(eq(projectsTable.id, orderedIds[i]!));
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_updated",
    targetType: "project",
    targetId: "bulk",
    sourceArea: "projects",
    details: `Reordered ${orderedIds.length} projects`,
  });

  const rows = await db.select().from(projectsTable).orderBy(asc(projectsTable.sortOrder), asc(projectsTable.name));
  res.json(rows.map(serializeProject));
});

router.get("/projects/blockers", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(blockersTable).orderBy(desc(blockersTable.ageDays));
  res.json(rows.map(serializeBlocker));
});

router.get("/projects/build-plans", requireAuth, requireDashboard, async (_req, res) => {
  const projectRows = await db.select().from(projectsTable).orderBy(asc(projectsTable.name));
  const plans = [];
  for (const project of projectRows) {
    await ensureBuildPlanForProject(project.id);
    const [row] = await db
      .select()
      .from(projectBuildPlansTable)
      .where(eq(projectBuildPlansTable.projectId, project.id))
      .limit(1);
    if (row) plans.push(serializeBuildPlan(row));
  }
  res.json(plans);
});

router.post("/projects/blockers", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can create blockers" });
    return;
  }
  const { title, projectId, owner, risk } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || !Number.isInteger(Number(projectId))) {
    res.status(400).json({ message: "Invalid blocker input" });
    return;
  }
  const pid = Number(projectId);
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, pid)).limit(1);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return;
  }
  const [created] = await db
    .insert(blockersTable)
    .values({
      title: title.trim(),
      projectId: pid,
      owner: typeof owner === "string" ? owner : null,
      risk: risk ?? "medium",
      ageDays: 0,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_blocker_created",
    targetType: "project_blocker",
    targetId: String(created.id),
    sourceArea: "projects",
    details: created.title,
  });
  res.status(201).json(serializeBlocker(created));
});

router.patch("/projects/blockers/:id", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can edit blockers" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid blocker id" });
    return;
  }
  const [existing] = await db.select().from(blockersTable).where(eq(blockersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Blocker not found" });
    return;
  }
  if (existing.title.startsWith("[sync]")) {
    res.status(403).json({ message: "Sync blockers are managed by overnight server updates" });
    return;
  }
  const patch: Partial<typeof existing> = {};
  if (typeof req.body?.title === "string") patch.title = req.body.title.trim();
  if (req.body?.owner !== undefined) patch.owner = req.body.owner;
  if (req.body?.risk !== undefined) patch.risk = req.body.risk;
  const [updated] = await db.update(blockersTable).set(patch).where(eq(blockersTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_blocker_updated",
    targetType: "project_blocker",
    targetId: String(id),
    sourceArea: "projects",
    details: updated.title,
  });
  res.json(serializeBlocker(updated));
});

router.delete("/projects/blockers/:id", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can remove blockers" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid blocker id" });
    return;
  }
  const [existing] = await db.select().from(blockersTable).where(eq(blockersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Blocker not found" });
    return;
  }
  if (existing.title.startsWith("[sync]")) {
    res.status(403).json({ message: "Sync blockers are managed by overnight server updates" });
    return;
  }
  await db.delete(blockersTable).where(eq(blockersTable.id, id));
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_blocker_deleted",
    targetType: "project_blocker",
    targetId: String(id),
    sourceArea: "projects",
    details: existing.title,
  });
  res.status(204).send();
});

router.get("/projects/handoffs", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(projectHandoffsTable).orderBy(desc(projectHandoffsTable.createdAt));
  res.json(rows.map(serializeHandoff));
});

router.patch("/projects/:id", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can update project details" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid project id" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  const patch: Partial<typeof project> = {};
  if (req.body?.projectType !== undefined) {
    if (!PROJECT_TYPES.includes(req.body.projectType)) {
      res.status(400).json({ message: "Invalid project type" });
      return;
    }
    patch.projectType = req.body.projectType as ProjectType;
  }
  if (req.body?.sortOrder !== undefined) {
    const sortOrder = Number(req.body.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      res.status(400).json({ message: "Invalid sortOrder" });
      return;
    }
    patch.sortOrder = sortOrder;
  }

  // --- Project Cleanup governance labels ---
  const enumField = <T extends readonly string[]>(
    key: keyof typeof project & string,
    allowed: T,
  ): boolean => {
    if (req.body?.[key] === undefined) return true;
    if (!allowed.includes(req.body[key])) {
      res.status(400).json({ message: `Invalid ${key}` });
      return false;
    }
    (patch as Record<string, unknown>)[key] = req.body[key];
    return true;
  };
  if (!enumField("stage", PROJECT_STAGES)) return;
  if (!enumField("finalIntention", PROJECT_FINAL_INTENTIONS)) return;
  if (!enumField("confidence", PROJECT_CONFIDENCE)) return;
  if (!enumField("cleanupPriority", PROJECT_PRIORITIES)) return;
  if (!enumField("sourceOfTruth", PROJECT_SOURCE_OF_TRUTH)) return;
  if (!enumField("agreementStatus", PROJECT_AGREEMENT_STATUSES)) return;
  if (req.body?.doNotClaim !== undefined) {
    patch.doNotClaim = req.body.doNotClaim === null ? null : String(req.body.doNotClaim);
  }
  if (req.body?.cleanupWave !== undefined) {
    const wave = Number(req.body.cleanupWave);
    if (![0, 1, 2, 3].includes(wave)) {
      res.status(400).json({ message: "Invalid cleanupWave" });
      return;
    }
    patch.cleanupWave = wave;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ message: "Nothing to update" });
    return;
  }

  const [updated] = await db.update(projectsTable).set(patch).where(eq(projectsTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_updated",
    targetType: "project",
    targetId: String(id),
    sourceArea: "projects",
    details: updated.name,
  });
  res.json(serializeProject(updated));
});

router.get("/projects/:id/plan", requireAuth, requireDashboard, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid project id" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  let [row] = await db
    .select()
    .from(projectBuildPlansTable)
    .where(eq(projectBuildPlansTable.projectId, id))
    .limit(1);

  if (!row) {
    await ensureBuildPlanForProject(id);
    [row] = await db
      .select()
      .from(projectBuildPlansTable)
      .where(eq(projectBuildPlansTable.projectId, id))
      .limit(1);
  }

  res.json(serializeBuildPlan(row!));
});

router.patch("/projects/:id/plan", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can edit the build plan" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid project id" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  const [existing] = await db
    .select()
    .from(projectBuildPlansTable)
    .where(eq(projectBuildPlansTable.projectId, id))
    .limit(1);

  const body = req.body ?? {};
  const patch: Partial<(typeof projectBuildPlansTable)["$inferInsert"]> = {
    source: "manual",
    updatedBy: actor.name,
  };

  if (typeof body.summary === "string") patch.summary = body.summary.trim();
  if (typeof body.carmenPlanNotes === "string") patch.carmenPlanNotes = body.carmenPlanNotes.trim();
  if (typeof body.progress === "number" && body.progress >= 0 && body.progress <= 100) {
    patch.progress = Math.round(body.progress);
  }
  if (Array.isArray(body.phases)) {
    patch.phases = body.phases as BuildPlanPhaseItem[];
    const active = patch.phases.find((p) => p.status === "active");
    if (active) patch.currentPhaseId = active.id;
  }
  if (typeof body.currentPhaseId === "string") patch.currentPhaseId = body.currentPhaseId;

  let row;
  if (existing) {
    [row] = await db
      .update(projectBuildPlansTable)
      .set(patch)
      .where(eq(projectBuildPlansTable.projectId, id))
      .returning();
  } else {
    const derived = deriveBuildPlanFromProject(project);
    [row] = await db
      .insert(projectBuildPlansTable)
      .values({
        projectId: id,
        ...derived,
        ...patch,
        roseInstructions: "",
      })
      .returning();
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "build_plan_updated",
    targetType: "project",
    targetId: String(id),
    sourceArea: "projects",
    details: project.name,
  });
  res.json(serializeBuildPlan(row!));
});

router.patch("/projects/:id/rose-instructions", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isRoseRole(actor.role)) {
    res.status(403).json({ message: "Only Rose can edit her instructions" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || typeof req.body?.roseInstructions !== "string") {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  const [existing] = await db
    .select()
    .from(projectBuildPlansTable)
    .where(eq(projectBuildPlansTable.projectId, id))
    .limit(1);

  let row;
  if (existing) {
    [row] = await db
      .update(projectBuildPlansTable)
      .set({ roseInstructions: req.body.roseInstructions.trim(), updatedBy: actor.name })
      .where(eq(projectBuildPlansTable.projectId, id))
      .returning();
  } else {
    const derived = deriveBuildPlanFromProject(project);
    [row] = await db
      .insert(projectBuildPlansTable)
      .values({
        projectId: id,
        ...derived,
        roseInstructions: req.body.roseInstructions.trim(),
        updatedBy: actor.name,
      })
      .returning();
  }

  res.json(serializeBuildPlan(row!));
});

router.post("/projects/:id/unblock-phase", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isRoseRole(actor.role)) {
    res.status(403).json({ message: "Only Rose can unlock the next phase" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid project id" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  const [existing] = await db
    .select()
    .from(projectBuildPlansTable)
    .where(eq(projectBuildPlansTable.projectId, id))
    .limit(1);

  const base = existing ?? {
    ...(await (async () => {
      const derived = deriveBuildPlanFromProject(project);
      const [inserted] = await db
        .insert(projectBuildPlansTable)
        .values({ projectId: id, ...derived, roseInstructions: "" })
        .returning();
      return inserted;
    })()),
  };

  const phases = unblockNextPhase(base.phases);
  const active = phases.find((p) => p.status === "active");

  const [row] = await db
    .update(projectBuildPlansTable)
    .set({
      phases,
      currentPhaseId: active?.id ?? base.currentPhaseId,
      source: "manual",
      updatedBy: actor.name,
    })
    .where(eq(projectBuildPlansTable.projectId, id))
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "phase_unblocked",
    targetType: "project",
    targetId: String(id),
    sourceArea: "projects",
    details: `${project.name}: ${active?.title ?? "next phase"}`,
  });
  res.json(serializeBuildPlan(row!));
});

router.post("/projects/:id/handoffs", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!isPlanEditor(actor.role)) {
    res.status(403).json({ message: "Only Rose or Carmen can upload handoff files" });
    return;
  }
  const id = Number(req.params.id);
  const { filename, contentBase64, mimeType } = req.body ?? {};
  if (!Number.isInteger(id) || typeof filename !== "string" || typeof contentBase64 !== "string") {
    res.status(400).json({ message: "filename and contentBase64 are required" });
    return;
  }
  const project = await getProjectOr404(id, res);
  if (!project) return;

  const safeName = basename(filename.trim()).replace(/[^\w.\-()+ ]/g, "_");
  if (!safeName) {
    res.status(400).json({ message: "Invalid filename" });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    res.status(400).json({ message: "Invalid file encoding" });
    return;
  }
  if (buffer.length === 0 || buffer.length > MAX_HANDOFF_BYTES) {
    res.status(400).json({ message: "File must be between 1 byte and 10MB" });
    return;
  }

  const dir = join(UPLOAD_ROOT, String(id));
  mkdirSync(dir, { recursive: true });
  const storagePath = join(dir, `${Date.now()}-${safeName}`);
  writeFileSync(storagePath, buffer);

  const [row] = await db
    .insert(projectHandoffsTable)
    .values({
      projectId: id,
      filename: safeName,
      storagePath,
      mimeType: typeof mimeType === "string" ? mimeType : null,
      sizeBytes: buffer.length,
      uploadedBy: actor.name,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "handoff_uploaded",
    targetType: "project",
    targetId: String(id),
    sourceArea: "projects",
    details: safeName,
  });
  res.status(201).json(serializeHandoff(row));
});

router.get("/projects/:id/handoffs/:handoffId/download", requireAuth, requireDashboard, async (req, res) => {
  const projectId = Number(req.params.id);
  const handoffId = Number(req.params.handoffId);
  if (!Number.isInteger(projectId) || !Number.isInteger(handoffId)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(projectHandoffsTable)
    .where(eq(projectHandoffsTable.id, handoffId))
    .limit(1);

  if (!row || row.projectId !== projectId) {
    res.status(404).json({ message: "Handoff file not found" });
    return;
  }
  if (!existsSync(row.storagePath)) {
    res.status(404).json({ message: "File missing on server" });
    return;
  }

  const data = readFileSync(row.storagePath);
  res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
  if (row.mimeType) res.setHeader("Content-Type", row.mimeType);
  res.send(data);
});

export default router;

export async function ensureBuildPlanForProject(projectId: number): Promise<void> {
  const [existing] = await db
    .select({ id: projectBuildPlansTable.id })
    .from(projectBuildPlansTable)
    .where(eq(projectBuildPlansTable.projectId, projectId))
    .limit(1);
  if (existing) return;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) return;

  const blockers = await db.select().from(blockersTable).where(eq(blockersTable.projectId, projectId));
  const derived = deriveBuildPlanFromProject(project, blockers);
  const projectType = project.projectType ?? inferProjectType(project);

  await db.insert(projectBuildPlansTable).values({
    projectId,
    ...derived,
    roseInstructions: "",
  });

  if (!project.projectType) {
    await db.update(projectsTable).set({ projectType }).where(eq(projectsTable.id, projectId));
  }
}
