import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, destroySession, toUserProfile, verifyPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { requireAuth } from "../middlewares/auth";

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
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: "login",
    targetType: "user",
    targetId: String(user.id),
    sourceArea: "auth",
  });
  res.json({ token, user: toUserProfile({ ...user, lastLoginAt: new Date() }) });
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const user = req.user!;
  if (req.sessionToken) await destroySession(req.sessionToken);
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

export default router;
