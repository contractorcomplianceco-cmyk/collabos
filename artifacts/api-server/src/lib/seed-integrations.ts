import { db, integrationStatusTable, type IntegrationStatusRow } from "@workspace/db";
import { asc } from "drizzle-orm";
import { logger } from "./logger";

const SEED_INTEGRATIONS = [
  { name: "WhatsApp", status: "Awaiting Rose & Carmen approval — not wired", state: "future" as const },
  { name: "Zoho Cliq", status: "Awaiting Rose & Carmen approval — test mode only", state: "future" as const },
  { name: "Email alerts", status: "Preference saved; live delivery awaiting approval", state: "disabled" as const },
  { name: "Gemini AI", status: "Planned — not connected in CollabOS", state: "planned" as const },
  { name: "Zoho CRM", status: "Planned — not connected in CollabOS", state: "planned" as const },
  { name: "Zoho WorkDrive", status: "Planned — not connected in CollabOS", state: "planned" as const },
  { name: "Company Brain", status: "Local CollabOS records", state: "simulated" as const },
];

export function serializeIntegrationStatus(row: IntegrationStatusRow) {
  return { name: row.name, status: row.status, state: row.state };
}

export async function seedIntegrationsIfEmpty(): Promise<void> {
  const existing = await db.select({ id: integrationStatusTable.id }).from(integrationStatusTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(integrationStatusTable).values(SEED_INTEGRATIONS);
  logger.info({ count: SEED_INTEGRATIONS.length }, "Seeded integration status list");
}

export async function listIntegrationStatus() {
  return db.select().from(integrationStatusTable).orderBy(asc(integrationStatusTable.name));
}
