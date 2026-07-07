import { Router, type IRouter } from "express";
import { CreateAgentWorkItemBody, UpdateAgentWorkItemBody, AddAgentWorkEventBody } from "@workspace/api-zod";
import { db, agentWorkItemsTable, type AgentWorkItemRow } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { agentWorkEvent, serializeAgentWorkItem } from "../lib/seed-agent-work";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

async function findAgentWorkItem(id: number): Promise<AgentWorkItemRow | undefined> {
  const [row] = await db.select().from(agentWorkItemsTable).where(eq(agentWorkItemsTable.id, id)).limit(1);
  return row;
}

router.get("/agent-work/items", requireAuth, requirePermission("agent_work_view"), async (_req, res) => {
  const rows = await db.select().from(agentWorkItemsTable).orderBy(desc(agentWorkItemsTable.updatedAt));
  res.json(rows.map(serializeAgentWorkItem));
});

router.post("/agent-work/items", requireAuth, async (req, res) => {
  const actor = req.user!;
  const canCreate =
    hasPermission(actor.role, "agent_work_manage") ||
    hasPermission(actor.role, "brain_suggest") ||
    hasPermission(actor.role, "external_intake_act");
  if (!canCreate) {
    res.status(403).json({ message: "Your role cannot create agent work items" });
    return;
  }

  const parsed = CreateAgentWorkItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid agent work item input" });
    return;
  }

  const [created] = await db
    .insert(agentWorkItemsTable)
    .values({
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      requestType: parsed.data.requestType,
      priority: parsed.data.priority,
      affectedModule: parsed.data.affectedModule.trim(),
      desiredOutcome: parsed.data.desiredOutcome.trim(),
      status: "new",
      owner: parsed.data.owner?.trim() || null,
      approvalRoute: parsed.data.approvalRoute,
      risk: parsed.data.risk,
      source: parsed.data.source?.trim() || "CollabOS",
      relatedIntakeId: parsed.data.relatedIntakeId ?? null,
      relatedRecommendationId: parsed.data.relatedRecommendationId ?? null,
      relatedProjectId: parsed.data.relatedProjectId ?? null,
      verificationSteps: parsed.data.verificationSteps ?? [],
      agentNotes: "",
      events: [agentWorkEvent(actor.name, "Work item created", parsed.data.desiredOutcome.trim())],
      createdById: actor.id,
      createdByName: actor.name,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "agent_work_item_created",
    targetType: "agent_work_item",
    targetId: String(created.id),
    sourceArea: "agent_queue",
    details: created.title,
  });

  res.status(201).json(serializeAgentWorkItem(created));
});

router.patch("/agent-work/items/:id", requireAuth, requirePermission("agent_work_manage"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateAgentWorkItemBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }

  const actor = req.user!;
  const existing = await findAgentWorkItem(id);
  if (!existing) {
    res.status(404).json({ message: "Agent work item not found" });
    return;
  }

  const statusChanged = parsed.data.status && parsed.data.status !== existing.status;
  const event = statusChanged
    ? agentWorkEvent(actor.name, `Status changed to ${parsed.data.status}`, parsed.data.agentNotes)
    : agentWorkEvent(actor.name, "Work item updated", parsed.data.agentNotes);
  const events = [...existing.events, event];

  const [updated] = await db
    .update(agentWorkItemsTable)
    .set({
      priority: parsed.data.priority ?? existing.priority,
      status: parsed.data.status ?? existing.status,
      owner: parsed.data.owner !== undefined ? parsed.data.owner : existing.owner,
      approvalRoute: parsed.data.approvalRoute ?? existing.approvalRoute,
      risk: parsed.data.risk ?? existing.risk,
      branchName: parsed.data.branchName !== undefined ? parsed.data.branchName : existing.branchName,
      commitSha: parsed.data.commitSha !== undefined ? parsed.data.commitSha : existing.commitSha,
      mergeRequestUrl: parsed.data.mergeRequestUrl !== undefined ? parsed.data.mergeRequestUrl : existing.mergeRequestUrl,
      verificationSteps: parsed.data.verificationSteps ?? existing.verificationSteps,
      agentNotes: parsed.data.agentNotes !== undefined ? parsed.data.agentNotes : existing.agentNotes,
      finalOutcome: parsed.data.finalOutcome !== undefined ? parsed.data.finalOutcome : existing.finalOutcome,
      events,
    })
    .where(eq(agentWorkItemsTable.id, id))
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: statusChanged ? "agent_work_status_changed" : "agent_work_item_updated",
    targetType: "agent_work_item",
    targetId: String(id),
    sourceArea: "agent_queue",
    details: statusChanged ? `${existing.status} -> ${updated.status}` : updated.title,
  });

  res.json(serializeAgentWorkItem(updated));
});

router.post("/agent-work/items/:id/events", requireAuth, requirePermission("agent_work_manage"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = AddAgentWorkEventBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid event input" });
    return;
  }

  const actor = req.user!;
  const existing = await findAgentWorkItem(id);
  if (!existing) {
    res.status(404).json({ message: "Agent work item not found" });
    return;
  }

  const [updated] = await db
    .update(agentWorkItemsTable)
    .set({
      events: [...existing.events, agentWorkEvent(parsed.data.actor || actor.name, parsed.data.action.trim(), parsed.data.note?.trim())],
    })
    .where(eq(agentWorkItemsTable.id, id))
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "agent_work_event_added",
    targetType: "agent_work_item",
    targetId: String(id),
    sourceArea: "agent_queue",
    details: parsed.data.action.slice(0, 200),
  });

  res.json(serializeAgentWorkItem(updated));
});

export default router;
