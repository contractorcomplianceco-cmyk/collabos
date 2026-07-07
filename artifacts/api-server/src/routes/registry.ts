import { Router, type IRouter } from "express";
import {
  db,
  alertsTable,
  automationsTable,
  buildItemsTable,
  companyRecordsTable,
  decisionsTable,
  duplicateRisksTable,
  projectTasksTable,
} from "@workspace/db";
import { asc, desc } from "drizzle-orm";
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

export default router;
