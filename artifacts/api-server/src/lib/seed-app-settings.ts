import { db, appSettingsTable, type AppSettingsRow } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_SETTINGS = {
  duplicateSensitivity: 75,
  alertThreshold: 3,
  reportCadence: "weekly" as const,
  competitors: [] as string[],
  marketKeywords: [] as string[],
  mindMeldPrivate: true,
  emailAlerts: false,
  zohoCliqMode: "test" as const,
  whatsappMode: "off" as const,
  lastTestMessageAt: null as string | null,
};

export function serializeAppSettings(row: AppSettingsRow) {
  return {
    duplicateSensitivity: row.duplicateSensitivity,
    alertThreshold: row.alertThreshold,
    reportCadence: row.reportCadence,
    competitors: row.competitors,
    marketKeywords: row.marketKeywords,
    mindMeldPrivate: row.mindMeldPrivate,
    emailAlerts: row.emailAlerts,
    zohoCliqMode: row.zohoCliqMode,
    whatsappMode: row.whatsappMode,
    lastTestMessageAt: row.lastTestMessageAt,
  };
}

export async function getOrCreateAppSettings(): Promise<AppSettingsRow> {
  const [existing] = await db.select().from(appSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(appSettingsTable).values(DEFAULT_SETTINGS).returning();
  logger.info("Seeded default app settings");
  return created;
}

export async function seedAppSettingsIfEmpty(): Promise<void> {
  await getOrCreateAppSettings();
}
