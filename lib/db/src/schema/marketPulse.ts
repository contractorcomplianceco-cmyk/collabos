import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { APPROVAL_ROUTES } from "./registry";

export const MARKET_SIGNAL_TYPES = [
  "competitor",
  "new-product",
  "positioning",
  "content-change",
  "pricing",
  "job-posting",
  "trend",
  "tech-shift",
  "compliance-opportunity",
] as const;

export const COMPETITOR_THREATS = ["low", "medium", "high", "watch"] as const;
export const MARKET_TRENDS = ["up", "down", "flat"] as const;
export const MARKET_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const marketSignalsTable = pgTable("market_signals", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  dateFound: text("date_found").notNull(),
  signalType: text("signal_type", { enum: MARKET_SIGNAL_TYPES }).notNull(),
  summary: text("summary").notNull(),
  opportunity: text("opportunity").notNull(),
  risk: text("risk", { enum: MARKET_RISK_LEVELS }).notNull(),
  recommendedResponse: text("recommended_response").notNull(),
  reviewOwner: text("review_owner", { enum: APPROVAL_ROUTES }).notNull(),
  // Live-news fields (null for legacy/manual signals):
  url: text("url"),
  // Which watched competitor/keyword surfaced this article.
  matchedTerm: text("matched_term"),
  // Stable id from the news source, used to dedupe on repeated refreshes.
  externalId: text("external_id").unique(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketCompetitorsTable = pgTable("market_competitors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  threat: text("threat", { enum: COMPETITOR_THREATS }).notNull(),
  trend: text("trend", { enum: MARKET_TRENDS }).notNull(),
  newsCount: integer("news_count").notNull().default(0),
  movement: integer("movement").notNull().default(0),
  series: jsonb("series").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MarketSignalRow = typeof marketSignalsTable.$inferSelect;
export type MarketCompetitorRow = typeof marketCompetitorsTable.$inferSelect;
