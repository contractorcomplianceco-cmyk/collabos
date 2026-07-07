import { Router, type IRouter } from "express";
import { CreateMemoryCandidateBody, UpdateMemoryCandidateStatusBody } from "@workspace/api-zod";
import { db, memoryCandidatesTable, type MemoryCandidateRow } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { historyTimestamp } from "../lib/recommendation-approval";
import { serializeMemoryCandidate } from "../lib/seed-memory-candidates";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function findCandidate(id: number): Promise<MemoryCandidateRow | undefined> {
  const [row] = await db.select().from(memoryCandidatesTable).where(eq(memoryCandidatesTable.id, id)).limit(1);
  return row;
}

router.get("/memory-candidates", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "external_intake_view") && !hasPermission(req.user!.role, "mind_meld_access")) {
    res.status(403).json({ message: "Your role cannot view memory candidates" });
    return;
  }
  const rows = await db.select().from(memoryCandidatesTable).orderBy(desc(memoryCandidatesTable.createdAt));
  res.json(rows.map(serializeMemoryCandidate));
});

router.post("/memory-candidates", requireAuth, async (req, res) => {
  const actor = req.user!;
  if (!hasPermission(actor.role, "external_intake_act") && !hasPermission(actor.role, "mind_meld_access")) {
    res.status(403).json({ message: "Your role cannot create memory candidates" });
    return;
  }
  const parsed = CreateMemoryCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid memory candidate input" });
    return;
  }
  const [created] = await db
    .insert(memoryCandidatesTable)
    .values({
      sourceIntakeId: parsed.data.sourceIntakeId ?? null,
      summary: parsed.data.summary.trim(),
      destination: parsed.data.destination,
      status: "proposed",
      sensitive: parsed.data.sensitive,
      createdBy: parsed.data.createdBy.trim(),
      createdAt: parsed.data.createdAt ?? historyTimestamp(),
      createdByUserId: actor.id,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "memory_candidate_created",
    targetType: "memory_candidate",
    targetId: String(created.id),
    sourceArea: "external_intake",
    details: created.summary.slice(0, 120),
  });
  res.status(201).json(serializeMemoryCandidate(created));
});

router.patch("/memory-candidates/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateMemoryCandidateStatusBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  if (!hasPermission(actor.role, "brain_approve") && !hasPermission(actor.role, "mind_meld_access")) {
    res.status(403).json({ message: "Your role cannot update memory candidates" });
    return;
  }
  const existing = await findCandidate(id);
  if (!existing) {
    res.status(404).json({ message: "Memory candidate not found" });
    return;
  }
  const [updated] = await db
    .update(memoryCandidatesTable)
    .set({ status: parsed.data.status })
    .where(eq(memoryCandidatesTable.id, id))
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "memory_candidate_status_changed",
    targetType: "memory_candidate",
    targetId: String(id),
    sourceArea: "external_intake",
    details: `${existing.status} -> ${parsed.data.status}`,
  });
  res.json(serializeMemoryCandidate(updated));
});

export default router;
