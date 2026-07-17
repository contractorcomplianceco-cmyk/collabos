import { db, usersTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const STAFF_ACCOUNTS = [
  { name: "Rose Taylor", email: "rose@ccacontact.com", role: "rose_admin" as const },
  { name: "Carmen Vega", email: "carmen@ccacontact.com", role: "carmen_admin" as const },
  { name: "Sam Rivera", email: "admin@ccacontact.com", role: "super_admin" as const },
];

export async function ensureStaffAccountsFromEnv(): Promise<void> {
  if (process.env.COLLABOS_PROMOTE_STAFF_ACCOUNTS?.trim() !== "true") return;

  const bootstrapPassword = process.env.COLLABOS_STAFF_BOOTSTRAP_PASSWORD?.trim();
  if (!bootstrapPassword) {
    logger.warn("COLLABOS_PROMOTE_STAFF_ACCOUNTS is true but COLLABOS_STAFF_BOOTSTRAP_PASSWORD is missing");
    return;
  }

  const passwordHash = hashPassword(bootstrapPassword);

  for (const account of STAFF_ACCOUNTS) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, account.email))
      .limit(1);

    if (existing) {
      await db
        .update(usersTable)
        .set({
          name: account.name,
          role: account.role,
          status: "active",
          isDemo: false,
          passwordHash,
          mustChangePassword: false,
        })
        .where(eq(usersTable.id, existing.id));
      continue;
    }

    await db.insert(usersTable).values({
      name: account.name,
      email: account.email,
      passwordHash,
      role: account.role,
      status: "active",
      isDemo: false,
      mustChangePassword: true,
    });
  }

  await db
    .update(usersTable)
    .set({ status: "inactive" })
    .where(like(usersTable.email, "%@collabos.demo"));

  logger.info(
    { staffCount: STAFF_ACCOUNTS.length },
    "Staff accounts ensured and demo logins deactivated",
  );
}
