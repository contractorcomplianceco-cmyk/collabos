import { pgTable, text, serial, real, timestamp } from "drizzle-orm/pg-core";

export const SENTIMENT_TRENDS = ["up", "down", "flat"] as const;
export const SOP_STATUSES = ["current", "needs-update", "missing"] as const;

export const sentimentSignalsTable = pgTable("sentiment_signals", {
  id: serial("id").primaryKey(),
  team: text("team").notNull(),
  score: real("score").notNull(),
  trend: text("trend", { enum: SENTIMENT_TRENDS }).notNull(),
  theme: text("theme").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sopsTable = pgTable("sops", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  area: text("area").notNull(),
  status: text("status", { enum: SOP_STATUSES }).notNull(),
  owner: text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SentimentSignalRow = typeof sentimentSignalsTable.$inferSelect;
export type SopRow = typeof sopsTable.$inferSelect;
