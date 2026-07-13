import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { createSession } from "../lib/auth";
import { setSessionCookie } from "../lib/session-cookie";
import { logAudit } from "../lib/audit";

/**
 * Staff presentation unlock for Command Center briefing links.
 * Does NOT remove public password login. Validates a short-lived HMAC signed
 * with CCA_STAFF_PRESENTATION_UNLOCK_SECRET, then issues a CollabOS session
 * (Carmen/Rose leadership area — Linda visibility during briefing).
 */
const router: IRouter = Router();

const PARTNER_ID = "collabos";
const MAX_TTL_MS = 10 * 60 * 1000;

function presentationSecret(): string | null {
  return process.env.CCA_STAFF_PRESENTATION_UNLOCK_SECRET?.trim() || null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function expectedSig(exp: string): string {
  const secret = presentationSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(`${PARTNER_ID}:${exp}`).digest("hex");
}

function safeNextPath(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/projects";
  }
  if (value.includes("://") || value.includes("@")) return "/projects";
  return value.slice(0, 200) || "/projects";
}

async function resolvePresentationUser() {
  const preferred = (
    process.env.CCA_PRESENTATION_UNLOCK_USER_EMAIL ||
    "carmen@ccacontact.com"
  )
    .trim()
    .toLowerCase();
  const candidates = [
    preferred,
    "carmen@ccacontact.com",
    "rose@ccacontact.com",
    "admin@ccacontact.com",
  ];
  const seen = new Set<string>();
  for (const email of candidates) {
    if (!email || seen.has(email)) continue;
    seen.add(email);
    try {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (user && user.status === "active") return user;
    } catch {
      // Ignore lookup failures and try next candidate.
    }
  }
  return null;
}

router.get("/staff/presentation-unlock", async (req, res): Promise<void> => {
  const secret = presentationSecret();
  if (!secret) {
    res
      .status(503)
      .type("html")
      .send(
        "<!doctype html><title>Unavailable</title><p>Staff presentation unlock is not configured.</p>",
      );
    return;
  }

  const exp = typeof req.query.exp === "string" ? req.query.exp.trim() : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig.trim() : "";
  const next = safeNextPath(req.query.next);

  if (!/^\d{10,16}$/.test(exp) || !/^[a-f0-9]{64}$/i.test(sig)) {
    res
      .status(400)
      .type("html")
      .send("<!doctype html><title>Invalid</title><p>Invalid staff unlock link.</p>");
    return;
  }

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now() || expMs > Date.now() + MAX_TTL_MS) {
    res
      .status(401)
      .type("html")
      .send(
        "<!doctype html><title>Expired</title><p>Staff unlock link expired. Open again from Command Center.</p>",
      );
    return;
  }

  if (!safeEqual(sig.toLowerCase(), expectedSig(exp))) {
    res
      .status(401)
      .type("html")
      .send("<!doctype html><title>Denied</title><p>Staff unlock denied.</p>");
    return;
  }

  const user = await resolvePresentationUser();
  if (!user) {
    res
      .status(503)
      .type("html")
      .send(
        "<!doctype html><title>Unavailable</title><p>No active CollabOS staff account is configured for presentation unlock.</p>",
      );
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
    details: "presentation_unlock",
  });

  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, next);
});

export default router;
