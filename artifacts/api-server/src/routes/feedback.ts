import { Router, type IRouter } from "express";
import { CreateFeedbackItemBody } from "@workspace/api-zod";
import { db, feedbackItemsTable, sentimentSignalsTable, sopsTable } from "@workspace/db";
import { desc, asc } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { serializeFeedbackItem } from "../lib/seed-feedback";
import { serializeSentimentSignal, serializeSop } from "../lib/seed-team-pulse";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/feedback/items", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view feedback" });
    return;
  }
  const rows = await db.select().from(feedbackItemsTable).orderBy(desc(feedbackItemsTable.updatedAt));
  res.json(rows.map(serializeFeedbackItem));
});

router.post("/feedback/items", requireAuth, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot submit feedback" });
    return;
  }
  const parsed = CreateFeedbackItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid feedback input" });
    return;
  }
  const [created] = await db
    .insert(feedbackItemsTable)
    .values({
      type: parsed.data.type,
      summary: parsed.data.summary.trim(),
      submittedBy: parsed.data.submittedBy.trim(),
      department: parsed.data.department.trim(),
      privacy: parsed.data.privacy,
      supportNeed: parsed.data.supportNeed.trim(),
      approvalRoute: parsed.data.approvalRoute,
      count: parsed.data.count ?? 1,
      createdById: actor.id,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "feedback_item_created",
    targetType: "feedback_item",
    targetId: String(created.id),
    sourceArea: "team_pulse",
    details: created.summary.slice(0, 120),
  });
  res.status(201).json(serializeFeedbackItem(created));
});

router.get("/feedback/sentiment-signals", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view sentiment signals" });
    return;
  }
  const rows = await db.select().from(sentimentSignalsTable).orderBy(asc(sentimentSignalsTable.team));
  res.json(rows.map(serializeSentimentSignal));
});

router.get("/feedback/sops", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view SOPs" });
    return;
  }
  const rows = await db.select().from(sopsTable).orderBy(asc(sopsTable.title));
  res.json(rows.map(serializeSop));
});

export default router;
