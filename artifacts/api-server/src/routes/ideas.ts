import { Router, type IRouter } from "express";
import { CreateIdeaBody, UpdateIdeaStatusBody, UpdateIdeaBody } from "@workspace/api-zod";
import { db, ideasTable, recommendationsTable, type Idea } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { serializeIdea } from "../lib/seed-ideas";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function findIdea(id: number): Promise<Idea | undefined> {
  const [row] = await db.select().from(ideasTable).where(eq(ideasTable.id, id)).limit(1);
  return row;
}

router.get("/ideas", requireAuth, async (_req, res) => {
  const rows = await db.select().from(ideasTable).orderBy(desc(ideasTable.updatedAt));
  res.json(rows.map(serializeIdea));
});

router.post("/ideas", requireAuth, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot submit ideas" });
    return;
  }
  const parsed = CreateIdeaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid idea input" });
    return;
  }
  const [created] = await db
    .insert(ideasTable)
    .values({
      title: parsed.data.title.trim(),
      description: parsed.data.description,
      submittedBy: parsed.data.submittedBy.trim(),
      status: parsed.data.status,
      momentum: parsed.data.momentum,
      cluster: parsed.data.cluster ?? null,
      benefits: parsed.data.benefits,
      risks: parsed.data.risks,
      dependencies: parsed.data.dependencies,
      approvalRoute: parsed.data.approvalRoute,
      createdAt: parsed.data.createdAt,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "idea_created",
    targetType: "idea",
    targetId: String(created.id),
    sourceArea: "innovation_lab",
    details: created.title,
  });
  res.status(201).json(serializeIdea(created));
});

router.patch("/ideas/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateIdeaStatusBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot update ideas" });
    return;
  }
  const existing = await findIdea(id);
  if (!existing) {
    res.status(404).json({ message: "Idea not found" });
    return;
  }
  const [updated] = await db
    .update(ideasTable)
    .set({ status: parsed.data.status })
    .where(eq(ideasTable.id, id))
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "idea_status_changed",
    targetType: "idea",
    targetId: String(id),
    sourceArea: "innovation_lab",
    details: `${existing.status} -> ${parsed.data.status}`,
  });
  res.json(serializeIdea(updated));
});

// Update editable idea fields (cluster, momentum, title/description).
router.patch("/ideas/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateIdeaBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot update ideas" });
    return;
  }
  const existing = await findIdea(id);
  if (!existing) {
    res.status(404).json({ message: "Idea not found" });
    return;
  }
  const patch: Partial<typeof ideasTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.cluster !== undefined) patch.cluster = parsed.data.cluster?.trim() || null;
  if (parsed.data.momentum !== undefined) patch.momentum = parsed.data.momentum;

  const [updated] = await db.update(ideasTable).set(patch).where(eq(ideasTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "idea_status_changed",
    targetType: "idea",
    targetId: String(id),
    sourceArea: "innovation_lab",
    details: `Updated idea "${updated.title}"`,
  });
  res.json(serializeIdea(updated));
});

// Promote an idea into the Review Queue as a recommendation, giving it a real
// exit path from the lab into the decision pipeline. Marks the idea approved.
router.post("/ideas/:id/promote", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid idea id" });
    return;
  }
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_suggest")) {
    res.status(403).json({ message: "Your role cannot promote ideas" });
    return;
  }
  const idea = await findIdea(id);
  if (!idea) {
    res.status(404).json({ message: "Idea not found" });
    return;
  }

  // Map the idea's approval route to the recommendation route (default: both).
  const requiredApprover =
    idea.approvalRoute === "rose" || idea.approvalRoute === "carmen" ? idea.approvalRoute : "both";

  await db.insert(recommendationsTable).values({
    source: "Innovation Lab",
    category: "final-decision",
    recommendation: `Build idea: ${idea.title}. ${idea.description}`.trim(),
    classification: "draft-idea",
    risk: "medium",
    requiredApprover,
    history: [
      {
        id: `rh-${Date.now()}`,
        timestamp: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        actor: actor.name,
        action: "Promoted from Innovation Lab",
      },
    ],
    createdByName: actor.name,
  });

  const [updated] = await db
    .update(ideasTable)
    .set({ status: "approved-for-build" })
    .where(eq(ideasTable.id, id))
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "idea_status_changed",
    targetType: "idea",
    targetId: String(id),
    sourceArea: "innovation_lab",
    details: `Promoted "${idea.title}" to Review Queue`,
  });

  res.json(serializeIdea(updated));
});

export default router;
