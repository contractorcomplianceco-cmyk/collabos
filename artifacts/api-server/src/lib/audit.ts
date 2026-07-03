import { db, auditLogsTable, type AuditAction } from "@workspace/db";
import { logger } from "./logger";

export async function logAudit(entry: {
  actorId: number | null;
  actorName: string;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  sourceArea: string;
  details?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorId: entry.actorId,
      actorName: entry.actorName,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      sourceArea: entry.sourceArea,
      details: entry.details ?? null,
    });
  } catch (err) {
    logger.error({ err }, "failed to write audit log");
  }
}
