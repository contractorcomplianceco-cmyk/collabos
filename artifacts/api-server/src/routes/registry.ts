import { Router, type IRouter } from "express";
import {
  CreateCompanyRecordBody,
  CreateProjectTaskBody,
  UpdateCompanyRecordBody,
  UpdateProjectTaskBody,
} from "@workspace/api-zod";
import {
  db,
  alertsTable,
  automationsTable,
  buildItemsTable,
  companyRecordsTable,
  decisionsTable,
  duplicateRisksTable,
  projectTasksTable,
  type CompanyRecordRow,
} from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import {
  serializeAlert,
  serializeAutomation,
  serializeBuildItem,
  serializeCompanyRecord,
  serializeDecision,
  serializeDuplicateRisk,
  serializeProjectTask,
} from "../lib/seed-registry";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function requireDashboard(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view registry data" });
    return;
  }
  next();
}

router.get("/company-records", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(companyRecordsTable).orderBy(asc(companyRecordsTable.title));
  res.json(rows.map(serializeCompanyRecord));
});

router.post("/company-records", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot create Company Brain records" });
    return;
  }
  const parsed = CreateCompanyRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Company Brain record input" });
    return;
  }
  const [created] = await db
    .insert(companyRecordsTable)
    .values({
      title: parsed.data.title.trim(),
      type: parsed.data.type.trim(),
      summary: parsed.data.summary.trim(),
      source: parsed.data.source?.trim() || "User entry",
      classification: parsed.data.classification as (typeof companyRecordsTable.$inferInsert)["classification"],
      keywords: parsed.data.keywords,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "company_record_created",
    targetType: "company_record",
    targetId: String(created.id),
    sourceArea: "solution_finder",
    details: created.title,
  });
  res.status(201).json(serializeCompanyRecord(created));
});

router.patch("/company-records/:id", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot edit Company Brain records" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = UpdateCompanyRecordBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const [existing] = await db.select().from(companyRecordsTable).where(eq(companyRecordsTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Company Brain record not found" });
    return;
  }
  const patch: Partial<typeof existing> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.type !== undefined) patch.type = parsed.data.type.trim();
  if (parsed.data.summary !== undefined) patch.summary = parsed.data.summary.trim();
  if (parsed.data.classification !== undefined) {
    patch.classification = parsed.data.classification as CompanyRecordRow["classification"];
  }
  if (parsed.data.keywords !== undefined) patch.keywords = parsed.data.keywords;
  const [updated] = await db.update(companyRecordsTable).set(patch).where(eq(companyRecordsTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "company_record_updated",
    targetType: "company_record",
    targetId: String(id),
    sourceArea: "solution_finder",
    details: updated.title,
  });
  res.json(serializeCompanyRecord(updated));
});

router.get("/decisions", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(decisionsTable).orderBy(asc(decisionsTable.title));
  res.json(rows.map(serializeDecision));
});

router.get("/automations", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(automationsTable).orderBy(asc(automationsTable.name));
  res.json(rows.map(serializeAutomation));
});

router.get("/duplicate-risks", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(duplicateRisksTable).orderBy(desc(duplicateRisksTable.similarity));
  res.json(rows.map(serializeDuplicateRisk));
});

router.get("/alerts", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt));
  res.json(rows.map(serializeAlert));
});

router.get("/build-items", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(buildItemsTable).orderBy(asc(buildItemsTable.name));
  res.json(rows.map(serializeBuildItem));
});

router.get("/project-tasks", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(projectTasksTable).orderBy(asc(projectTasksTable.title));
  res.json(rows.map(serializeProjectTask));
});

router.post("/project-tasks", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot create project tasks" });
    return;
  }
  const parsed = CreateProjectTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid project task input" });
    return;
  }
  const [created] = await db
    .insert(projectTasksTable)
    .values({
      title: parsed.data.title.trim(),
      projectId: parsed.data.projectId,
      owner: parsed.data.owner ?? null,
      status: parsed.data.status ?? "todo",
      dueDate: parsed.data.due ?? null,
      source: parsed.data.source ?? "manual",
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_task_created",
    targetType: "project_task",
    targetId: String(created.id),
    sourceArea: "project_tasks",
    details: created.title,
  });
  res.status(201).json(serializeProjectTask(created));
});

router.patch("/project-tasks/:id", requireAuth, requireDashboard, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot edit project tasks" });
    return;
  }
  const id = Number(req.params.id);
  const parsed = UpdateProjectTaskBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const [existing] = await db.select().from(projectTasksTable).where(eq(projectTasksTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ message: "Project task not found" });
    return;
  }
  const patch: Partial<typeof existing> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.projectId !== undefined) patch.projectId = parsed.data.projectId;
  if (parsed.data.owner !== undefined) patch.owner = parsed.data.owner;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.due !== undefined) patch.dueDate = parsed.data.due;
  if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
    if (parsed.data.status === "done") {
      patch.completedAt = new Date();
    } else if (existing.status === "done") {
      patch.completedAt = null;
    }
  }
  const [updated] = await db.update(projectTasksTable).set(patch).where(eq(projectTasksTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "project_task_updated",
    targetType: "project_task",
    targetId: String(id),
    sourceArea: "project_tasks",
    details: `${existing.status} -> ${updated.status}: ${updated.title}`,
  });
  res.json(serializeProjectTask(updated));
});

export default router;
