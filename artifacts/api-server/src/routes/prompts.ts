import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  promptsTable,
  PROMPT_INTENTS,
  PROMPT_SHARED_WITH,
  type Prompt,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { serializePrompt, seedPromptsIfEmpty } from "../lib/seed-prompts";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50000),
  intent: z.enum(PROMPT_INTENTS),
  projectId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const updateBody = createBody.partial().extend({
  sharedWith: z.enum(PROMPT_SHARED_WITH).nullable().optional(),
});

const shareBody = z.object({
  sharedWith: z.enum(PROMPT_SHARED_WITH),
});

function actorLabel(role: string, name: string): string {
  if (role === "rose_admin") return "Rose";
  if (role === "carmen_admin") return "Carmen";
  return name.split(/\s+/)[0] || name;
}

async function findActive(id: number): Promise<Prompt | undefined> {
  const [row] = await db
    .select()
    .from(promptsTable)
    .where(and(eq(promptsTable.id, id), isNull(promptsTable.deletedAt)))
    .limit(1);
  return row;
}

router.get("/prompts", requireAuth, async (_req, res) => {
  await seedPromptsIfEmpty();
  const rows = await db
    .select()
    .from(promptsTable)
    .where(isNull(promptsTable.deletedAt))
    .orderBy(desc(promptsTable.updatedAt));
  res.json(rows.map(serializePrompt));
});

router.post("/prompts", requireAuth, async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid prompt input" });
    return;
  }
  const actor = req.user!;
  const createdBy = actorLabel(actor.role, actor.name);
  const [created] = await db
    .insert(promptsTable)
    .values({
      title: parsed.data.title,
      body: parsed.data.body,
      intent: parsed.data.intent,
      projectId: parsed.data.projectId ?? null,
      tags: parsed.data.tags ?? [],
      createdBy,
      createdById: actor.id,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "prompt_created",
    targetType: "prompt",
    targetId: String(created.id),
    sourceArea: "prompt_library",
    details: created.title.slice(0, 200),
  });

  res.status(201).json(serializePrompt(created));
});

router.patch("/prompts/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid prompt update" });
    return;
  }
  const row = await findActive(id);
  if (!row) {
    res.status(404).json({ message: "Prompt not found" });
    return;
  }

  const patch = parsed.data;
  const sharedWith =
    patch.sharedWith === undefined ? undefined : patch.sharedWith;
  const [updated] = await db
    .update(promptsTable)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.intent !== undefined ? { intent: patch.intent } : {}),
      ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(sharedWith !== undefined
        ? {
            sharedWith,
            sharedAt: sharedWith ? new Date() : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(promptsTable.id, id))
    .returning();

  await logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    action: "prompt_updated",
    targetType: "prompt",
    targetId: String(id),
    sourceArea: "prompt_library",
    details: updated.title.slice(0, 200),
  });

  res.json(serializePrompt(updated));
});

router.post("/prompts/:id/share", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = shareBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid share target" });
    return;
  }
  const row = await findActive(id);
  if (!row) {
    res.status(404).json({ message: "Prompt not found" });
    return;
  }

  const [updated] = await db
    .update(promptsTable)
    .set({
      sharedWith: parsed.data.sharedWith,
      sharedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(promptsTable.id, id))
    .returning();

  await logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    action: "prompt_shared",
    targetType: "prompt",
    targetId: String(id),
    sourceArea: "prompt_library",
    details: `Shared with ${parsed.data.sharedWith}: ${updated.title.slice(0, 160)}`,
  });

  res.json(serializePrompt(updated));
});

router.delete("/prompts/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid prompt id" });
    return;
  }
  const row = await findActive(id);
  if (!row) {
    res.status(404).json({ message: "Prompt not found" });
    return;
  }

  const [updated] = await db
    .update(promptsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(promptsTable.id, id))
    .returning();

  await logAudit({
    actorId: req.user!.id,
    actorName: req.user!.name,
    action: "prompt_deleted",
    targetType: "prompt",
    targetId: String(id),
    sourceArea: "prompt_library",
    details: row.title.slice(0, 200),
  });

  res.json(serializePrompt(updated));
});

export default router;
