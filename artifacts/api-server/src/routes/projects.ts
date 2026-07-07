import { Router, type IRouter } from "express";
import { db, blockersTable, projectsTable } from "@workspace/db";
import { asc, desc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { serializeBlocker, serializeProject } from "../lib/seed-projects";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view projects" });
    return;
  }
  const rows = await db.select().from(projectsTable).orderBy(asc(projectsTable.name));
  res.json(rows.map(serializeProject));
});

router.get("/projects/blockers", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view blockers" });
    return;
  }
  const rows = await db.select().from(blockersTable).orderBy(desc(blockersTable.ageDays));
  res.json(rows.map(serializeBlocker));
});

export default router;
