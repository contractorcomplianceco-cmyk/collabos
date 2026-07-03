import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

// Demo accounts, clearly labeled as demo data. Passwords are intentionally
// simple because this is a demo workspace; they are printed on the login page.
export const DEMO_USERS = [
  { name: "Rose (Founder Admin)", email: "rose@collabos.demo", password: "rose-demo-2026", role: "rose_admin" as const },
  { name: "Carmen (Systems Admin)", email: "carmen@collabos.demo", password: "carmen-demo-2026", role: "carmen_admin" as const },
  { name: "Sam (Super Admin)", email: "admin@collabos.demo", password: "admin-demo-2026", role: "super_admin" as const },
  { name: "Lena (Leadership Reviewer)", email: "lena@collabos.demo", password: "lena-demo-2026", role: "leadership_reviewer" as const },
  { name: "Devon (Contributor)", email: "devon@collabos.demo", password: "devon-demo-2026", role: "contributor" as const },
  { name: "Vic (Viewer)", email: "viewer@collabos.demo", password: "viewer-demo-2026", role: "viewer" as const },
  { name: "Guest Pass", email: "guest@collabos.demo", password: "guest-demo-2026", role: "guest" as const },
];

export async function seedDemoUsersIfEmpty(): Promise<void> {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(usersTable).values(
    DEMO_USERS.map((u) => ({
      name: u.name,
      email: u.email,
      passwordHash: hashPassword(u.password),
      role: u.role,
      isDemo: true,
    })),
  );
  logger.info({ count: DEMO_USERS.length }, "Seeded demo users (labeled demo accounts)");
}
