import { db, integrationStatusTable, type IntegrationStatusRow } from "@workspace/db";
import { asc } from "drizzle-orm";
import { logger } from "./logger";

const SEED_INTEGRATIONS = [
  { name: "Company Brain", status: "Simulated / local", state: "simulated" as const },
  { name: "Zoho", status: "Not connected / future", state: "future" as const },
  { name: "WorkDrive", status: "Not connected / future", state: "future" as const },
  { name: "Supabase", status: "Planned", state: "planned" as const },
  { name: "Email alerts", status: "Disabled", state: "disabled" as const },
  { name: "Market monitoring", status: "Not connected", state: "disabled" as const },
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
