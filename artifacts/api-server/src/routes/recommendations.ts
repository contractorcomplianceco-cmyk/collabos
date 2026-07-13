import { Router, type IRouter } from "express";
import { CreateRecommendationBody, ChangeRecommendationStatusBody } from "@workspace/api-zod";
import {
  db,
  recommendationsTable,
  type Recommendation,
  type RecommendationHistoryEntry,
  type RecommendationStatus,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { resolveProjectForRecommendation } from "../lib/match-project";
import {
  actorLabel,
  canApproveRecommendation,
  historyId,
  historyTimestamp,
} from "../lib/recommendation-approval";
import { serializeRecommendation } from "../lib/seed-recommendations";
import { applySignoffFollowUp } from "../lib/signoff-followup";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

async function findRecommendation(id: number): Promise<Recommendation | undefined> {
  const [row] = await db.select().from(recommendationsTable).where(eq(recommendationsTable.id, id)).limit(1);
  return row;
}

router.get("/recommendations", requireAuth, requirePermission("review_queue_view"), async (_req, res) => {
  const rows = await db.select().from(recommendationsTable).orderBy(desc(recommendationsTable.updatedAt));
  res.json(rows.map(serializeRecommendation));
});

router.post("/recommendations", requireAuth, async (req, res) => {
  const actor = req.user!;
  const canCreate =
    hasPermission(actor.role, "brain_suggest") ||
    hasPermission(actor.role, "external_intake_act") ||
    hasPermission(actor.role, "mockup_studio_edit");
  if (!canCreate) {
    res.status(403).json({ message: "Your role cannot create recommendations" });
    return;
  }

  const parsed = CreateRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid recommendation input" });
    return;
  }

  const history: RecommendationHistoryEntry[] = [
    {
      id: historyId("rh"),
      timestamp: historyTimestamp(),
      actor: actor.name,
      action: "Recommendation created",
    },
  ];

  const explicitProjectId = parsed.data.projectId ?? null;
  const match = await resolveProjectForRecommendation(
    parsed.data.recommendation,
    parsed.data.source,
    explicitProjectId,
  );

  const [created] = await db
    .insert(recommendationsTable)
    .values({
      source: parsed.data.source.trim(),
      category: parsed.data.category,
      recommendation: parsed.data.recommendation.trim(),
      classification: parsed.data.classification,
      risk: parsed.data.risk,
      requiredApprover: parsed.data.requiredApprover,
      status: "pending",
      approvals: { rose: false, carmen: false },
      history,
      projectId: match?.id ?? null,
      createdById: actor.id,
      createdByName: actor.name,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "recommendation_created",
    targetType: "recommendation",
    targetId: String(created.id),
    sourceArea: "review_queue",
    details: parsed.data.recommendation.slice(0, 200),
  });

  res.status(201).json(serializeRecommendation(created));
});

router.post("/recommendations/:id/status", requireAuth, requirePermission("review_queue_approve"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ChangeRecommendationStatusBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }

  const row = await findRecommendation(id);
  if (!row) {
    res.status(404).json({ message: "Recommendation not found" });
    return;
  }

  const actor = req.user!;
  const requested = parsed.data.status as RecommendationStatus;
  if (!canApproveRecommendation(actor.role, row.requiredApprover)) {
    res.status(403).json({ message: "You cannot approve or reject this recommendation" });
    return;
  }

  const actorName = actorLabel(actor.role);
  let nextStatus = requested;
  let approvals = { ...(row.approvals ?? { rose: false, carmen: false }) };
  let historyAction = `Marked ${requested}`;

  if (requested === "approved") {
    if (actor.role === "rose_admin" || actor.role === "super_admin") approvals.rose = true;
    if (actor.role === "carmen_admin" || actor.role === "super_admin") approvals.carmen = true;
    if (row.requiredApprover === "both") {
      const fully = approvals.rose && approvals.carmen;
      nextStatus = fully ? "approved" : "pending";
      historyAction = fully
        ? "Final approval recorded (Rose + Carmen)"
        : `Signed off by ${actorName} — awaiting ${approvals.rose ? "Carmen" : "Rose"}`;
    } else {
      historyAction = `Signed off by ${actorName}`;
    }
  } else if (requested === "rejected") {
    historyAction = `Sent back by ${actorName}`;
  }

  const history: RecommendationHistoryEntry[] = [
    ...row.history,
    {
      id: historyId("rh"),
      timestamp: historyTimestamp(),
      actor: actorName,
      action: historyAction,
    },
  ];

  const [updated] = await db
    .update(recommendationsTable)
    .set({ status: nextStatus, approvals, history })
    .where(eq(recommendationsTable.id, id))
    .returning();

  let followUp = null;
  if (requested === "approved") {
    followUp = await applySignoffFollowUp(updated, actor.role);
    if (followUp.projectId && followUp.projectId !== updated.projectId) {
      updated.projectId = followUp.projectId;
    }
  }

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "recommendation_status_changed",
    targetType: "recommendation",
    targetId: String(id),
    sourceArea: "review_queue",
    details: followUp?.taskId
      ? `${row.status} -> ${nextStatus}; task #${followUp.taskId} for ${followUp.taskOwner}`
      : `${row.status} -> ${nextStatus}`,
  });

  const refreshed = await findRecommendation(id);
  res.json({
    ...serializeRecommendation(refreshed ?? updated),
    followUp,
  });
});

export default router;
