import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  reportDate: text("report_date").notNull(),
  summary: text("summary").notNull(),
  findings: jsonb("findings").$type<string[]>().notNull().default([]),
  sourceData: jsonb("source_data").$type<string[]>().notNull().default([]),
  risks: jsonb("risks").$type<string[]>().notNull().default([]),
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),
  decisionsNeeded: jsonb("decisions_needed").$type<string[]>().notNull().default([]),
  owners: jsonb("owners").$type<string[]>().notNull().default([]),
  nextSteps: jsonb("next_steps").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReportTemplateRow = typeof reportTemplatesTable.$inferSelect;
