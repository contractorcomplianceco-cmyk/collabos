import { Router, type IRouter } from "express";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { CreateAgentWorkItemBody, UpdateAgentWorkItemBody, AddAgentWorkEventBody } from "@workspace/api-zod";
import {
  db,
  agentWorkAttachmentsTable,
  agentWorkItemsTable,
  type AgentWorkAttachmentRow,
  type AgentWorkItemRow,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { agentWorkEvent, serializeAgentWorkItem } from "../lib/seed-agent-work";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

const UPLOAD_ROOT = "/var/collabos/uploads/agent-work";
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".zip",
  ".md",
  ".html",
  ".htm",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".csv",
  ".xlsx",
  ".xls",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".json",
  ".pptx",
  ".ppt",
  ".rtf",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".msi",
  ".ps1",
  ".com",
  ".scr",
  ".dll",
  ".jar",
  ".app",
  ".dmg",
  ".pkg",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
]);

function canCreateAgentWork(role: Parameters<typeof hasPermission>[0]): boolean {
  return (
    hasPermission(role, "agent_work_manage") ||
    hasPermission(role, "brain_suggest") ||
    hasPermission(role, "external_intake_act")
  );
}

function serializeAttachment(row: AgentWorkAttachmentRow) {
  return {
    id: row.id,
    agentWorkItemId: row.agentWorkItemId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.createdAt.toISOString(),
  };
}

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
  if (!canCreateAgentWork(actor.role)) {
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

router.get("/agent-work/items/:id/attachments", requireAuth, requirePermission("agent_work_view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  const existing = await findAgentWorkItem(id);
  if (!existing) {
    res.status(404).json({ message: "Agent work item not found" });
    return;
  }

  const rows = await db
    .select()
    .from(agentWorkAttachmentsTable)
    .where(eq(agentWorkAttachmentsTable.agentWorkItemId, id))
    .orderBy(desc(agentWorkAttachmentsTable.createdAt));

  res.json(rows.map(serializeAttachment));
});

router.post("/agent-work/items/:id/attachments", requireAuth, async (req, res) => {
  const actor = req.user!;
  if (!canCreateAgentWork(actor.role)) {
    res.status(403).json({ message: "Your role cannot attach files to Cursor requests" });
    return;
  }

  const id = Number(req.params.id);
  const { filename, contentBase64, mimeType } = req.body ?? {};
  if (!Number.isInteger(id) || typeof filename !== "string" || typeof contentBase64 !== "string") {
    res.status(400).json({ message: "filename and contentBase64 are required" });
    return;
  }

  const existing = await findAgentWorkItem(id);
  if (!existing) {
    res.status(404).json({ message: "Agent work item not found" });
    return;
  }

  const safeName = basename(filename.trim()).replace(/[^\w.\-()+ ]/g, "_");
  if (!safeName) {
    res.status(400).json({ message: "Invalid filename" });
    return;
  }

  const ext = extname(safeName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
    res.status(400).json({
      message: "That file type isn't allowed. Use documents like PDF, Word, Markdown, HTML, ZIP, images, or spreadsheets.",
    });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    res.status(400).json({ message: "Invalid file encoding" });
    return;
  }
  if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_BYTES) {
    res.status(400).json({ message: "File must be between 1 byte and 25MB" });
    return;
  }

  const dir = join(UPLOAD_ROOT, String(id));
  mkdirSync(dir, { recursive: true });
  const storagePath = join(dir, `${Date.now()}-${safeName}`);
  writeFileSync(storagePath, buffer);

  const [row] = await db
    .insert(agentWorkAttachmentsTable)
    .values({
      agentWorkItemId: id,
      filename: safeName,
      mimeType: typeof mimeType === "string" ? mimeType : null,
      sizeBytes: buffer.length,
      storagePath,
      uploadedBy: actor.name,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "agent_work_attachment_uploaded",
    targetType: "agent_work_item",
    targetId: String(id),
    sourceArea: "agent_queue",
    details: safeName,
  });

  res.status(201).json(serializeAttachment(row));
});

router.get(
  "/agent-work/items/:id/attachments/:attachmentId/download",
  requireAuth,
  requirePermission("agent_work_view"),
  async (req, res) => {
    const id = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(id) || !Number.isInteger(attachmentId)) {
      res.status(400).json({ message: "Invalid id" });
      return;
    }

    const [row] = await db
      .select()
      .from(agentWorkAttachmentsTable)
      .where(eq(agentWorkAttachmentsTable.id, attachmentId))
      .limit(1);

    if (!row || row.agentWorkItemId !== id) {
      res.status(404).json({ message: "Attachment not found" });
      return;
    }
    if (!existsSync(row.storagePath)) {
      res.status(404).json({ message: "File missing on server" });
      return;
    }

    const data = readFileSync(row.storagePath);
    res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
    if (row.mimeType) res.setHeader("Content-Type", row.mimeType);
    res.send(data);
  },
);

export default router;
