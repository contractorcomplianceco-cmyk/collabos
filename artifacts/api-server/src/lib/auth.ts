import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { permissionsForRole } from "./permissions";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
}

export async function getUserForToken(token: string): Promise<User | null> {
  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user || user.status !== "active") return null;
  return user;
}

export function toUserProfile(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsForRole(user.role),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    moduleLastSeen: user.moduleLastSeen ?? {},
    createdAt: user.createdAt.toISOString(),
  };
}
