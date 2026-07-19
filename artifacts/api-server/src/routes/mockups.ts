import { Router, type IRouter } from "express";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { tmpdir } from "node:os";
import { CreateMockupBody, UpdateMockupBody, ChangeMockupStatusBody, CreateMockupVersionBody, UploadMockupReferenceImageBody } from "@workspace/api-zod";
import { db, mockupsTable, mockupVersionsTable, mockupReferenceImagesTable, type Mockup, type MockupStatus, type MockupVersion, type MockupReferenceImage } from "@workspace/db";
import { desc, eq, asc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { logAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

// Configurable upload root. Defaults to /var/collabos in production but falls
// back to a writable temp dir where /var isn't writable (sandboxes, local dev).
function resolveUploadRoot(): string {
  const base = process.env.UPLOAD_DIR || "/var/collabos/uploads";
  const dir = join(base, "mockup-references");
  try {
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    const fallback = join(tmpdir(), "collabos-uploads", "mockup-references");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
const REFERENCE_UPLOAD_ROOT = resolveUploadRoot();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function serializeReferenceImage(row: MockupReferenceImage) {
  // Inline the image as a data URL so the client can render a thumbnail without
  // a second request. Reference images are small and few per mockup.
  let dataUrl = "";
  try {
    if (existsSync(row.storagePath)) {
      const b64 = readFileSync(row.storagePath).toString("base64");
      dataUrl = `data:${row.mimeType ?? "image/png"};base64,${b64}`;
    }
  } catch {
    dataUrl = "";
  }
  return {
    id: row.id,
    mockupId: row.mockupId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    dataUrl,
    caption: row.caption,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeMockup(m: Mockup) {
  return {
    id: m.id,
    title: m.title,
    sourceType: m.sourceType,
    sourceItemId: m.sourceItemId,
    sourceSummary: m.sourceSummary,
    ownerId: m.ownerId,
    ownerName: m.ownerName,
    status: m.status,
    brief: m.brief,
    screens: m.screens,
    visualDirection: m.visualDirection,
    statusNote: m.statusNote,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function serializeVersion(v: MockupVersion) {
  return {
    id: v.id,
    mockupId: v.mockupId,
    versionName: v.versionName,
    content: v.content,
    notes: v.notes,
    createdById: v.createdById,
    createdByName: v.createdByName,
    createdAt: v.createdAt.toISOString(),
  };
}

async function findMockup(id: number): Promise<Mockup | undefined> {
  const [m] = await db.select().from(mockupsTable).where(eq(mockupsTable.id, id)).limit(1);
  return m;
}

router.get("/mockups", requireAuth, requirePermission("mockup_studio_view"), async (_req, res) => {
  const rows = await db.select().from(mockupsTable).orderBy(desc(mockupsTable.updatedAt));
  res.json(rows.map(serializeMockup));
});

router.post("/mockups", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const parsed = CreateMockupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid mockup input" });
    return;
  }
  const actor = req.user!;
  const [created] = await db
    .insert(mockupsTable)
    .values({
      title: parsed.data.title,
      sourceType: parsed.data.sourceType,
      sourceItemId: parsed.data.sourceItemId ?? null,
      sourceSummary: parsed.data.sourceSummary ?? null,
      ownerId: actor.id,
      ownerName: actor.name,
      status: "draft",
      brief: parsed.data.brief,
      screens: parsed.data.screens,
      visualDirection: parsed.data.visualDirection,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_created",
    targetType: "mockup",
    targetId: String(created.id),
    sourceArea: "mockup_studio",
    details: `Created mockup "${created.title}"`,
  });
  res.status(201).json(serializeMockup(created));
});

router.get("/mockups/:id", requireAuth, requirePermission("mockup_studio_view"), async (req, res) => {
  const id = Number(req.params.id);
  const m = Number.isInteger(id) ? await findMockup(id) : undefined;
  if (!m) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }
  res.json(serializeMockup(m));
});

router.patch("/mockups/:id", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateMockupBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const m = await findMockup(id);
  if (!m) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }
  if (m.status === "approved_for_build" || m.status === "archived") {
    res.status(400).json({ message: "Approved or archived mockups cannot be edited. Send it back to draft first." });
    return;
  }
  const actor = req.user!;
  const updates: Partial<typeof mockupsTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.brief !== undefined) updates.brief = parsed.data.brief;
  if (parsed.data.screens !== undefined) updates.screens = parsed.data.screens;
  if (parsed.data.visualDirection !== undefined) updates.visualDirection = parsed.data.visualDirection;
  const [updated] = await db.update(mockupsTable).set(updates).where(eq(mockupsTable.id, id)).returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_updated",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `Updated mockup "${updated.title}"`,
  });
  res.json(serializeMockup(updated));
});

router.delete("/mockups/:id", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const id = Number(req.params.id);
  const m = Number.isInteger(id) ? await findMockup(id) : undefined;
  if (!m) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }
  const actor = req.user!;
  if (m.status === "approved_for_build" && !hasPermission(actor.role, "mockup_approve_rose") && !hasPermission(actor.role, "mockup_approve_carmen")) {
    res.status(403).json({ message: "Only leadership can delete an approved mockup" });
    return;
  }
  await db.delete(mockupsTable).where(eq(mockupsTable.id, id));
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_updated",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `Deleted mockup "${m.title}"`,
  });
  res.json({ message: "Mockup deleted" });
});

const REVIEW_STATUSES: MockupStatus[] = ["needs_rose_review", "needs_carmen_review", "needs_both_review"];

router.post("/mockups/:id/status", requireAuth, requirePermission("mockup_studio_view"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = ChangeMockupStatusBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const m = await findMockup(id);
  if (!m) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }
  const actor = req.user!;
  const requested = parsed.data.status as MockupStatus;
  const note = parsed.data.note ?? null;
  const canRose = hasPermission(actor.role, "mockup_approve_rose");
  const canCarmen = hasPermission(actor.role, "mockup_approve_carmen");
  const canEdit = hasPermission(actor.role, "mockup_studio_edit");

  let finalStatus: MockupStatus = requested;

  if (requested === "approved_for_build") {
    if (!REVIEW_STATUSES.includes(m.status)) {
      res.status(400).json({ message: "A mockup must be submitted for review before it can be approved" });
      return;
    }
    if (m.status === "needs_rose_review" && !canRose) {
      res.status(403).json({ message: "Only Rose (or a super admin) can approve this mockup" });
      return;
    }
    if (m.status === "needs_carmen_review" && !canCarmen) {
      res.status(403).json({ message: "Only Carmen (or a super admin) can approve this mockup" });
      return;
    }
    if (m.status === "needs_both_review") {
      if (canRose && canCarmen) {
        finalStatus = "approved_for_build";
      } else if (canRose) {
        finalStatus = "needs_carmen_review";
      } else if (canCarmen) {
        finalStatus = "needs_rose_review";
      } else {
        res.status(403).json({ message: "Only Rose or Carmen can approve this mockup" });
        return;
      }
    }
  } else if (requested === "sent_back") {
    if (!canRose && !canCarmen) {
      res.status(403).json({ message: "Only a reviewer can send a mockup back" });
      return;
    }
  } else if (!canEdit) {
    res.status(403).json({ message: "Your role cannot change mockup status" });
    return;
  }

  const [updated] = await db
    .update(mockupsTable)
    .set({ status: finalStatus, statusNote: note })
    .where(eq(mockupsTable.id, id))
    .returning();

  const approvedNow = finalStatus === "approved_for_build";
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: approvedNow ? "mockup_approved" : requested === "sent_back" ? "mockup_rejected" : "mockup_status_changed",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `"${m.title}": ${m.status} -> ${finalStatus}${note ? ` (${note})` : ""}`,
  });
  res.json(serializeMockup(updated));
});

router.get("/mockups/:id/versions", requireAuth, requirePermission("mockup_studio_view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid mockup id" });
    return;
  }
  const rows = await db
    .select()
    .from(mockupVersionsTable)
    .where(eq(mockupVersionsTable.mockupId, id))
    .orderBy(desc(mockupVersionsTable.createdAt));
  res.json(rows.map(serializeVersion));
});

router.post("/mockups/:id/versions", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateMockupVersionBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const m = await findMockup(id);
  if (!m) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }
  const actor = req.user!;
  const [created] = await db
    .insert(mockupVersionsTable)
    .values({
      mockupId: id,
      versionName: parsed.data.versionName,
      content: { brief: m.brief, screens: m.screens, visualDirection: m.visualDirection },
      notes: parsed.data.notes ?? null,
      createdById: actor.id,
      createdByName: actor.name,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_version_created",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `Version "${created.versionName}" of "${m.title}"`,
  });
  res.status(201).json(serializeVersion(created));
});

// --- Reference images --------------------------------------------------------

router.get("/mockups/:id/reference-images", requireAuth, requirePermission("mockup_studio_view"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid mockup id" });
    return;
  }
  const rows = await db
    .select()
    .from(mockupReferenceImagesTable)
    .where(eq(mockupReferenceImagesTable.mockupId, id))
    .orderBy(asc(mockupReferenceImagesTable.createdAt));
  res.json(rows.map(serializeReferenceImage));
});

router.post("/mockups/:id/reference-images", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UploadMockupReferenceImageBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "filename and contentBase64 are required" });
    return;
  }

  const mockup = await findMockup(id);
  if (!mockup) {
    res.status(404).json({ message: "Mockup not found" });
    return;
  }

  const actor = req.user!;
  const safeName = basename(parsed.data.filename.trim()).replace(/[^\w.\-()+ ]/g, "_");
  const ext = extname(safeName).toLowerCase();
  if (!safeName || !ALLOWED_IMAGE_EXT.has(ext)) {
    res.status(400).json({ message: "Reference must be an image (PNG, JPG, GIF, WEBP, or SVG)." });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.contentBase64, "base64");
  } catch {
    res.status(400).json({ message: "Invalid file encoding" });
    return;
  }
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    res.status(400).json({ message: "Image must be between 1 byte and 8MB" });
    return;
  }

  const dir = join(REFERENCE_UPLOAD_ROOT, String(id));
  mkdirSync(dir, { recursive: true });
  const storagePath = join(dir, `${Date.now()}-${safeName}`);
  writeFileSync(storagePath, buffer);

  const [row] = await db
    .insert(mockupReferenceImagesTable)
    .values({
      mockupId: id,
      filename: safeName,
      mimeType: parsed.data.mimeType ?? null,
      sizeBytes: buffer.length,
      storagePath,
      caption: parsed.data.caption ?? null,
      uploadedBy: actor.name,
    })
    .returning();

  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_reference_uploaded",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `Reference "${safeName}" on "${mockup.title}"`,
  });

  res.status(201).json(serializeReferenceImage(row));
});

router.delete("/mockups/:id/reference-images/:imageId", requireAuth, requirePermission("mockup_studio_edit"), async (req, res) => {
  const id = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!Number.isInteger(id) || !Number.isInteger(imageId)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(mockupReferenceImagesTable)
    .where(eq(mockupReferenceImagesTable.id, imageId))
    .limit(1);
  if (!row || row.mockupId !== id) {
    res.status(404).json({ message: "Reference image not found" });
    return;
  }

  try {
    if (existsSync(row.storagePath)) rmSync(row.storagePath);
  } catch {
    // Best-effort file cleanup; the DB row is the source of truth.
  }
  await db.delete(mockupReferenceImagesTable).where(eq(mockupReferenceImagesTable.id, imageId));

  const actor = req.user!;
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "mockup_reference_deleted",
    targetType: "mockup",
    targetId: String(id),
    sourceArea: "mockup_studio",
    details: `Removed reference "${row.filename}"`,
  });

  res.json({ message: "Reference image deleted" });
});

export default router;
