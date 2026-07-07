import { Router, type IRouter } from "express";
import {
  CreateMindMeldItemBody,
  CarmenfyMindMeldItemBody,
  RosifyMindMeldItemBody,
  AddMindMeldThoughtBody,
} from "@workspace/api-zod";
import {
  db,
  mindMeldHandoffsTable,
  mindMeldItemsTable,
  mindMeldTimelineTable,
  mindFeedTable,
  type MindMeldItemRow,
  type MindMeldStatus,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { historyId, historyTimestamp } from "../lib/recommendation-approval";
import {
  serializeMindMeldHandoff,
  serializeMindMeldItem,
  serializeMindMeldTimeline,
  serializeMindFeedEntry,
} from "../lib/seed-mind-meld";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

async function findItem(id: number): Promise<MindMeldItemRow | undefined> {
  const [row] = await db.select().from(mindMeldItemsTable).where(eq(mindMeldItemsTable.id, id)).limit(1);
  return row;
}

function timelineActor(actor: string): "Rose" | "Carmen" | "Rose OS" | "System" {
  return actor === "Rose" || actor === "Carmen" || actor === "Rose OS" ? actor : "System";
}

router.get("/mind-meld/items", requireAuth, requirePermission("mind_meld_access"), async (_req, res) => {
  const rows = await db.select().from(mindMeldItemsTable).orderBy(desc(mindMeldItemsTable.updatedAt));
  res.json(rows.map(serializeMindMeldItem));
});

router.get("/mind-meld/handoffs", requireAuth, requirePermission("mind_meld_access"), async (_req, res) => {
  const rows = await db.select().from(mindMeldHandoffsTable).orderBy(desc(mindMeldHandoffsTable.createdAt));
  res.json(rows.map(serializeMindMeldHandoff));
});

router.get("/mind-meld/timeline", requireAuth, requirePermission("mind_meld_access"), async (_req, res) => {
  const rows = await db.select().from(mindMeldTimelineTable).orderBy(desc(mindMeldTimelineTable.createdAt));
  res.json(rows.map(serializeMindMeldTimeline));
});

router.get("/mind-meld/feed", requireAuth, requirePermission("mind_meld_access"), async (_req, res) => {
  const rows = await db.select().from(mindFeedTable).orderBy(desc(mindFeedTable.createdAt));
  res.json(rows.map(serializeMindFeedEntry));
});

router.post("/mind-meld/items", requireAuth, requirePermission("mind_meld_access"), async (req, res) => {
  const parsed = CreateMindMeldItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid Mind Meld item input" });
    return;
  }
  const actor = req.user!;
  const [created] = await db
    .insert(mindMeldItemsTable)
    .values({
      title: parsed.data.title.trim(),
      source: parsed.data.source.trim(),
      owner: parsed.data.owner,
      status: parsed.data.status as MindMeldStatus,
      roseThoughts: parsed.data.roseThoughts ?? "",
      carmenThoughts: parsed.data.carmenThoughts ?? "",
      synthesis: parsed.data.synthesis,
      openQuestions: parsed.data.openQuestions,
      alignment: parsed.data.alignment,
      alignmentScore: parsed.data.alignmentScore,
      risk: parsed.data.risk,
      privacy: parsed.data.privacy,
      nextHandoff: parsed.data.nextHandoff ?? null,
      layers: parsed.data.layers,
      focusAreas: parsed.data.focusAreas,
      roseFeedback: parsed.data.roseFeedback ?? [],
      carmenFeedback: parsed.data.carmenFeedback ?? [],
      sensitive: parsed.data.sensitive,
      history: parsed.data.history ?? [],
      createdById: actor.id,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mind_meld_item_created",
    targetType: "mind_meld_item",
    targetId: String(created.id),
    sourceArea: "mind_meld",
    details: created.title,
  });
  await db.insert(mindMeldTimelineTable).values({
    itemTitle: created.title,
    type: "original-message",
    actor: timelineActor(parsed.data.history?.[0]?.actor ?? actor.name),
    text: parsed.data.history?.[0]?.action ?? `Created from ${created.source}.`,
    eventTimestamp: parsed.data.history?.[0]?.timestamp ?? historyTimestamp(),
    sensitive: created.sensitive,
    needs: created.nextHandoff ?? null,
    readyTo: null,
    finalized: false,
  });
  res.status(201).json(serializeMindMeldItem(created));
});

router.post("/mind-meld/items/:id/carmenfy", requireAuth, requirePermission("mind_meld_access"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CarmenfyMindMeldItemBody.safeParse(req.body ?? {});
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid item id" });
    return;
  }
  const actor = req.user!;
  if (actor.role !== "rose_admin" && actor.role !== "super_admin") {
    res.status(403).json({ message: "Only Rose can Carmenfy an item" });
    return;
  }
  const item = await findItem(id);
  if (!item) {
    res.status(404).json({ message: "Mind Meld item not found" });
    return;
  }
  const note = parsed.success ? parsed.data.note ?? "" : "";
  const history = [
    ...item.history,
    { id: historyId("h"), timestamp: historyTimestamp(), actor: "Rose", action: "Carmenfied — routed to Carmen" },
  ];
  const [updated] = await db
    .update(mindMeldItemsTable)
    .set({ status: "with-carmen", nextHandoff: "carmen", history })
    .where(eq(mindMeldItemsTable.id, id))
    .returning();
  await db.insert(mindMeldHandoffsTable).values({
    itemId: id,
    itemTitle: item.title,
    fromPerson: "Rose",
    toPerson: "Carmen",
    layer: "Execution",
    eventTimestamp: historyTimestamp(),
    note: note || "Vision framed, ready to operationalize.",
  });
  await db.insert(mindMeldTimelineTable).values({
    itemTitle: item.title,
    type: "routing-action",
    actor: "Rose",
    text: note || "Carmenfied — routed to Carmen.",
    eventTimestamp: historyTimestamp(),
    sensitive: item.sensitive,
    needs: "carmen",
    readyTo: null,
    finalized: false,
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mind_meld_handoff",
    targetType: "mind_meld_item",
    targetId: String(id),
    sourceArea: "mind_meld",
    details: `Carmenfied "${item.title}"`,
  });
  res.json(serializeMindMeldItem(updated));
});

router.post("/mind-meld/items/:id/rosify", requireAuth, requirePermission("mind_meld_access"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = RosifyMindMeldItemBody.safeParse(req.body ?? {});
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid item id" });
    return;
  }
  const actor = req.user!;
  if (actor.role !== "carmen_admin" && actor.role !== "super_admin") {
    res.status(403).json({ message: "Only Carmen can Rosify an item" });
    return;
  }
  const item = await findItem(id);
  if (!item) {
    res.status(404).json({ message: "Mind Meld item not found" });
    return;
  }
  const note = parsed.success ? parsed.data.note ?? "" : "";
  const history = [
    ...item.history,
    { id: historyId("h"), timestamp: historyTimestamp(), actor: "Carmen", action: "Rosified — routed to Rose" },
  ];
  const [updated] = await db
    .update(mindMeldItemsTable)
    .set({ status: "with-rose", nextHandoff: "rose", history })
    .where(eq(mindMeldItemsTable.id, id))
    .returning();
  await db.insert(mindMeldHandoffsTable).values({
    itemId: id,
    itemTitle: item.title,
    fromPerson: "Carmen",
    toPerson: "Rose",
    layer: "Strategy",
    eventTimestamp: historyTimestamp(),
    note: note || "Systems plan ready for founder review.",
  });
  await db.insert(mindMeldTimelineTable).values({
    itemTitle: item.title,
    type: "routing-action",
    actor: "Carmen",
    text: note || "Rosified — routed to Rose.",
    eventTimestamp: historyTimestamp(),
    sensitive: item.sensitive,
    needs: "rose",
    readyTo: null,
    finalized: false,
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mind_meld_handoff",
    targetType: "mind_meld_item",
    targetId: String(id),
    sourceArea: "mind_meld",
    details: `Rosified "${item.title}"`,
  });
  res.json(serializeMindMeldItem(updated));
});

router.post("/mind-meld/items/:id/thoughts", requireAuth, requirePermission("mind_meld_access"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = AddMindMeldThoughtBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  const item = await findItem(id);
  if (!item) {
    res.status(404).json({ message: "Mind Meld item not found" });
    return;
  }
  if (parsed.data.owner === "Rose" && actor.role !== "rose_admin" && actor.role !== "super_admin") {
    res.status(403).json({ message: "Only Rose can update Rose thoughts" });
    return;
  }
  if (parsed.data.owner === "Carmen" && actor.role !== "carmen_admin" && actor.role !== "super_admin") {
    res.status(403).json({ message: "Only Carmen can update Carmen thoughts" });
    return;
  }
  const history = [
    ...item.history,
    {
      id: historyId("h"),
      timestamp: historyTimestamp(),
      actor: parsed.data.owner,
      action: "Added a thought",
    },
  ];
  const [updated] = await db
    .update(mindMeldItemsTable)
    .set({
      roseThoughts: parsed.data.owner === "Rose" ? parsed.data.text : item.roseThoughts,
      carmenThoughts: parsed.data.owner === "Carmen" ? parsed.data.text : item.carmenThoughts,
      history,
    })
    .where(eq(mindMeldItemsTable.id, id))
    .returning();
  await db.insert(mindMeldTimelineTable).values({
    itemTitle: item.title,
    type: parsed.data.owner === "Rose" ? "rose-thought" : "carmen-thought",
    actor: parsed.data.owner,
    text: parsed.data.text,
    eventTimestamp: historyTimestamp(),
    sensitive: item.sensitive,
    needs: parsed.data.owner === "Rose" ? "carmen" : "rose",
    readyTo: null,
    finalized: false,
  });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mind_meld_item_updated",
    targetType: "mind_meld_item",
    targetId: String(id),
    sourceArea: "mind_meld",
    details: `${parsed.data.owner} updated thoughts`,
  });
  res.json(serializeMindMeldItem(updated));
});

export default router;
