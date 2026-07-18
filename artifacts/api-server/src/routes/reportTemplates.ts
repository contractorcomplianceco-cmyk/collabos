import { Router, type IRouter } from "express";
import { db, reportTemplatesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { CreateReportTemplateBody } from "@workspace/api-zod";
import { hasPermission } from "../lib/permissions";
import { serializeReportTemplate } from "../lib/seed-report-templates";
import { requireAuth } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/report-templates", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view report templates" });
    return;
  }
  const rows = await db.select().from(reportTemplatesTable).orderBy(desc(reportTemplatesTable.reportDate));
  res.json(rows.map(serializeReportTemplate));
});

// Save a generated report as a reusable template. Anyone who can act on the
// workspace (i.e. submit work) can save one.
router.post("/report-templates", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "build_prompt_generate")) {
    res.status(403).json({ message: "Your role cannot save report templates" });
    return;
  }
  const parsed = CreateReportTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Report type, title, and summary are required" });
    return;
  }

  const actor = req.user!;
  const input = parsed.data;
  const reportDate = new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(reportTemplatesTable)
    .values({
      type: input.type,
      title: input.title,
      reportDate,
      summary: input.summary,
      findings: input.findings ?? [],
      risks: input.risks ?? [],
      recommendations: input.recommendations ?? [],
      decisionsNeeded: input.decisionsNeeded ?? [],
      nextSteps: input.nextSteps ?? [],
      owners: [actor.name],
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "report_template_created",
    targetType: "report_template",
    targetId: String(row.id),
    sourceArea: "executive_reports",
    details: input.title.slice(0, 200),
  });

  res.json(serializeReportTemplate(row));
});

export default router;
