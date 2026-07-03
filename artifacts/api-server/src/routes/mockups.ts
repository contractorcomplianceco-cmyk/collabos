import { Router, type IRouter } from "express";
import { CreateMockupBody, UpdateMockupBody, ChangeMockupStatusBody, CreateMockupVersionBody } from "@workspace/api-zod";
import { db, mockupsTable, mockupVersionsTable, type Mockup, type MockupStatus, type MockupVersion } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { logAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

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

export default router;
