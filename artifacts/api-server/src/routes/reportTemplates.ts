import { Router, type IRouter } from "express";
import { db, reportTemplatesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { serializeReportTemplate } from "../lib/seed-report-templates";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/report-templates", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view report templates" });
    return;
  }
  const rows = await db.select().from(reportTemplatesTable).orderBy(desc(reportTemplatesTable.reportDate));
  res.json(rows.map(serializeReportTemplate));
});

export default router;
