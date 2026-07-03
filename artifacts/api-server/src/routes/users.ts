import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, toUserProfile } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router: IRouter = Router();

router.use("/users", requireAuth, requirePermission("user_management"));

router.get("/users", async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  res.json(users.map(toUserProfile));
});

router.post("/users", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input: name, email, role, and a password of at least 8 characters are required" });
    return;
  }
  const actor = req.user!;
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(400).json({ message: "A user with this email already exists" });
    return;
  }
  const [created] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name.trim(),
      email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
      isDemo: parsed.data.isDemo ?? false,
    })
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "user_created",
    targetType: "user",
    targetId: String(created.id),
    sourceArea: "user_management",
    details: `Created ${created.name} (${created.email}) with role ${created.role}`,
  });
  res.status(201).json(toUserProfile(created));
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }
  const actor = req.user!;
  const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!before) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (before.id === actor.id && parsed.data.status === "inactive") {
    res.status(400).json({ message: "You cannot deactivate your own account" });
    return;
  }
  if (before.id === actor.id && parsed.data.role && parsed.data.role !== actor.role) {
    res.status(400).json({ message: "You cannot change your own role" });
    return;
  }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.name) updates.name = parsed.data.name.trim();
  if (parsed.data.email) updates.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.role) updates.role = parsed.data.role;
  if (parsed.data.status) updates.status = parsed.data.status;
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (parsed.data.role && parsed.data.role !== before.role) {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "role_changed",
      targetType: "user",
      targetId: String(id),
      sourceArea: "user_management",
      details: `${before.name}: ${before.role} -> ${parsed.data.role}`,
    });
  }
  if (parsed.data.status && parsed.data.status !== before.status) {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: parsed.data.status === "inactive" ? "user_deactivated" : "user_activated",
      targetType: "user",
      targetId: String(id),
      sourceArea: "user_management",
      details: `${before.name}: ${before.status} -> ${parsed.data.status}`,
    });
  }
  if ((parsed.data.name && parsed.data.name !== before.name) || (parsed.data.email && parsed.data.email !== before.email)) {
    await logAudit({
      actorId: actor.id,
      actorName: actor.name,
      action: "user_updated",
      targetType: "user",
      targetId: String(id),
      sourceArea: "user_management",
      details: `Updated profile for ${before.name}`,
    });
  }
  res.json(toUserProfile(updated));
});

router.post("/users/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Invalid user id" });
    return;
  }
  const actor = req.user!;
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  const tempPassword = `temp-${randomBytes(6).toString("hex")}`;
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(usersTable.id, id))
    .returning();
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: "password_reset",
    targetType: "user",
    targetId: String(id),
    sourceArea: "user_management",
    details: `Temporary password issued for ${target.name}`,
  });
  res.json({ tempPassword, user: toUserProfile(updated) });
});

export default router;
