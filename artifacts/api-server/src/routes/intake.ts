import { Router, type IRouter } from "express";
import { CreateIntakeItemBody, UpdateIntakeItemBody } from "@workspace/api-zod";
import { db, intakeItemsTable, type IntakeItemRow } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { historyId, historyTimestamp } from "../lib/recommendation-approval";
import { serializeIntakeItem } from "../lib/seed-intake";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

async function findIntakeItem(id: number): Promise<IntakeItemRow | undefined> {
  const [row] = await db.select().from(intakeItemsTable).where(eq(intakeItemsTable.id, id)).limit(1);
  return row;
}

router.get("/intake/items", requireAuth, requirePermission("external_intake_view"), async (_req, res) => {
  const rows = await db.select().from(intakeItemsTable).orderBy(desc(intakeItemsTable.receivedAt));
  res.json(rows.map(serializeIntakeItem));
});

router.post("/intake/items", requireAuth, requirePermission("external_intake_act"), async (req, res) => {
  const parsed = CreateIntakeItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid intake item input" });
    return;
  }
  const actor = req.user!;
  const [created] = await db
    .insert(intakeItemsTable)
    .values({
      source: parsed.data.source,
      sourceChannel: parsed.data.sourceChannel.trim(),
      senderName: parsed.data.senderName.trim(),
      senderHandle: parsed.data.senderHandle.trim(),
      senderRole: parsed.data.senderRole ?? null,
      receivedAt: parsed.data.receivedAt ?? historyTimestamp(),
      rawMessage: parsed.data.rawMessage,
      cleanedSummary: parsed.data.cleanedSummary,
      detectedType: parsed.data.detectedType,
      suggestedDestination: parsed.data.suggestedDestination,
      sensitivity: parsed.data.sensitivity,
      reviewOwner: parsed.data.reviewOwner,
      status: parsed.data.status,
      duplicateRisk: parsed.data.duplicateRisk,
      relatedProjectNames: parsed.data.relatedProjectNames,
      reviewerNotes: parsed.data.reviewerNotes ?? "",
      finalActionTaken: null,
      nextStep: parsed.data.nextStep,
      classificationReason: parsed.data.classificationReason,
      auditLog: parsed.data.auditLog,
      createdById: actor.id,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "intake_item_created",
    targetType: "intake_item",
    targetId: String(created.id),
    sourceArea: "external_intake",
    details: created.cleanedSummary.slice(0, 120),
  });
  res.status(201).json(serializeIntakeItem(created));
});

router.patch("/intake/items/:id", requireAuth, requirePermission("external_intake_act"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateIntakeItemBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  const existing = await findIntakeItem(id);
  if (!existing) {
    res.status(404).json({ message: "Intake item not found" });
    return;
  }
  const auditLog = parsed.data.auditEntry
    ? [
        ...existing.auditLog,
        {
          id: historyId("al"),
          timestamp: historyTimestamp(),
          actor: parsed.data.auditEntry.actor,
          action: parsed.data.auditEntry.action,
        },
      ]
    : existing.auditLog;
  const [updated] = await db
    .update(intakeItemsTable)
    .set({
      status: parsed.data.status ?? existing.status,
      reviewOwner: parsed.data.reviewOwner ?? existing.reviewOwner,
      reviewerNotes: parsed.data.reviewerNotes ?? existing.reviewerNotes,
      finalActionTaken:
        parsed.data.finalActionTaken !== undefined ? parsed.data.finalActionTaken : existing.finalActionTaken,
      auditLog,
    })
    .where(eq(intakeItemsTable.id, id))
    .returning();
  const auditAction = parsed.data.status === "routed" || parsed.data.status === "archived"
    ? "intake_routed"
    : "intake_item_updated";
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: auditAction,
    targetType: "intake_item",
    targetId: String(id),
    sourceArea: "external_intake",
    details: parsed.data.auditEntry?.action ?? parsed.data.status ?? "updated",
  });
  res.json(serializeIntakeItem(updated));
});

export default router;
