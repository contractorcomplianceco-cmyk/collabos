import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const REPORT_CADENCES = ["daily", "weekly", "monthly"] as const;
export type ReportCadence = (typeof REPORT_CADENCES)[number];

export const INTEGRATION_MODES = ["off", "test", "live"] as const;
export type IntegrationMode = (typeof INTEGRATION_MODES)[number];

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  duplicateSensitivity: integer("duplicate_sensitivity").notNull().default(75),
  alertThreshold: integer("alert_threshold").notNull().default(3),
  reportCadence: text("report_cadence", { enum: REPORT_CADENCES }).notNull().default("weekly"),
  competitors: jsonb("competitors").$type<string[]>().notNull().default([]),
  marketKeywords: jsonb("market_keywords").$type<string[]>().notNull().default([]),
  mindMeldPrivate: boolean("mind_meld_private").notNull().default(true),
  emailAlerts: boolean("email_alerts").notNull().default(false),
  zohoCliqMode: text("zoho_cliq_mode", { enum: INTEGRATION_MODES }).notNull().default("test"),
  whatsappMode: text("whatsapp_mode", { enum: INTEGRATION_MODES }).notNull().default("off"),
  lastTestMessageAt: text("last_test_message_at"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettingsRow = typeof appSettingsTable.$inferSelect;
