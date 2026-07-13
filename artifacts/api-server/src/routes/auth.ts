import { Router, type IRouter } from "express";
import { LoginBody, MarkModuleSeenBody } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, destroySession, hashPassword, toUserProfile, verifyPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { requireAuth } from "../middlewares/auth";
import { clearSessionCookie, setSessionCookie } from "../lib/session-cookie";

function parseChangePasswordBody(body: unknown): { currentPassword: string; newPassword: string } | null {
  if (!body || typeof body !== "object") return null;
  const { currentPassword, newPassword } = body as Record<string, unknown>;
  if (typeof currentPassword !== "string" || currentPassword.length < 1) return null;
  if (typeof newPassword !== "string" || newPassword.length < 8) return null;
  return { currentPassword, newPassword };
}

const VALID_MODULES = new Set([
  "dashboard",
  "review-queue",
  "mind-meld",
  "agent-queue",
  "external-intake",
  "project-tasks",
  "carmen-path",
  "projects",
]);

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    await logAudit({
      actorId: user?.id ?? null,
      actorName: email,
      action: "login_failed",
      targetType: "user",
      targetId: user ? String(user.id) : null,
      sourceArea: "auth",
      details: "Invalid credentials",
    });
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }
  if (user.status !== "active") {
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "login_failed",
      targetType: "user",
      targetId: String(user.id),
      sourceArea: "auth",
      details: "Account deactivated",
    });
    res.status(401).json({ message: "This account has been deactivated" });
    return;
  }
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "login",
    targetType: "user",
    targetId: String(user.id),
    sourceArea: "auth",
  });
  // Token in JSON kept for one-deploy backward compat; browser should use httpOnly cookie.
  res.json({ token, user: toUserProfile({ ...user, lastLoginAt: new Date() }) });
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const user = req.user!;
  if (req.sessionToken) await destroySession(req.sessionToken);
  clearSessionCookie(res);
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "logout",
    targetType: "user",
    targetId: String(user.id),
    sourceArea: "auth",
  });
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, (req, res) => {
  res.json(toUserProfile(req.user!));
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const parsed = parseChangePasswordBody(req.body);
  if (!parsed) {
    res.status(400).json({ message: "Current password and a new password of at least 8 characters are required" });
    return;
  }
  const user = req.user!;
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
  if (!row || !verifyPassword(parsed.currentPassword, row.passwordHash)) {
    res.status(401).json({ message: "Current password is incorrect" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(parsed.newPassword), mustChangePassword: false })
    .where(eq(usersTable.id, user.id))
    .returning();
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "user_updated",
    targetType: "user",
    targetId: String(user.id),
    sourceArea: "auth",
    details: "Password changed by user",
  });
  res.json(toUserProfile(updated));
});

router.patch("/auth/module-seen", requireAuth, async (req, res) => {
  const parsed = MarkModuleSeenBody.safeParse(req.body);
  if (!parsed.success || !VALID_MODULES.has(parsed.data.module)) {
    res.status(400).json({ message: "Invalid module" });
    return;
  }
  const user = req.user!;
  const moduleLastSeen = {
    ...(user.moduleLastSeen ?? {}),
    [parsed.data.module]: new Date().toISOString(),
  };
  const [updated] = await db
    .update(usersTable)
    .set({ moduleLastSeen })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(toUserProfile(updated));
});

export default router;
