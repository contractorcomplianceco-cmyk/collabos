import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const INTEGRATION_STATES = ["simulated", "future", "planned", "disabled", "sample"] as const;

export const integrationStatusTable = pgTable("integration_status", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  state: text("state", { enum: INTEGRATION_STATES }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntegrationStatusRow = typeof integrationStatusTable.$inferSelect;
