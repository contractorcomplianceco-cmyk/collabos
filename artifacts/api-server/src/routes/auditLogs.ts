import { Router, type IRouter } from "express";
import { RecordAuditEventBody } from "@workspace/api-zod";
import { db, auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/audit-logs", requireAuth, requirePermission("audit_logs_view"), async (_req, res) => {
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(500);
  res.json(
    rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      sourceArea: r.sourceArea,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/audit-logs", requireAuth, async (req, res) => {
  const parsed = RecordAuditEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid audit event" });
    return;
  }
  const actor = req.user!;
  if (actor.role === "guest" || actor.role === "viewer") {
    res.status(403).json({ message: "Your role cannot record workspace actions" });
    return;
  }
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: parsed.data.action,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId ?? null,
    sourceArea: parsed.data.sourceArea,
    details: parsed.data.details ?? null,
  });
  res.status(201).json({
    id: 0,
    actorId: actor.id,
    actorName: actor.name,
    action: parsed.data.action,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId ?? null,
    sourceArea: parsed.data.sourceArea,
    details: parsed.data.details ?? null,
    createdAt: new Date().toISOString(),
  });
});

export default router;
