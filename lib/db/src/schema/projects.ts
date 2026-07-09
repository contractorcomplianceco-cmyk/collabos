import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PROJECT_STATUSES = ["active", "at-risk", "blocked", "stale", "complete", "planning"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const PROJECT_CLASSIFICATIONS = [
  "documented-fact",
  "user-update",
  "ai-recommendation",
  "draft-idea",
  "pending-approval",
  "approved-decision",
  "sensitive",
] as const;

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  department: text("department").notNull(),
  owner: text("owner"),
  status: text("status", { enum: PROJECT_STATUSES }).notNull().default("active"),
  risk: text("risk", { enum: PROJECT_RISK_LEVELS }).notNull().default("medium"),
  progress: integer("progress").notNull().default(0),
  source: text("source").notNull(),
  classification: text("classification", { enum: PROJECT_CLASSIFICATIONS }).notNull().default("documented-fact"),
  lastActivity: text("last_activity").notNull(),
  deadline: text("deadline"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const blockersTable = pgTable("project_blockers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  owner: text("owner"),
  risk: text("risk", { enum: PROJECT_RISK_LEVELS }).notNull().default("medium"),
  ageDays: integer("age_days").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectRow = typeof projectsTable.$inferSelect;
export type BlockerRow = typeof blockersTable.$inferSelect;
