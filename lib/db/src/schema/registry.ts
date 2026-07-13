import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const CLASSIFICATIONS = [
  "documented-fact",
  "user-update",
  "ai-recommendation",
  "draft-idea",
  "pending-approval",
  "approved-decision",
  "sensitive",
] as const;

export const APPROVAL_ROUTES = ["rose", "carmen", "both", "none"] as const;
export const REGISTRY_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const DECISION_STATUSES = ["open", "decided", "deferred"] as const;
export const AUTOMATION_STATUSES = ["live", "draft", "proposed", "paused"] as const;
export const BUILD_ITEM_STATUSES = ["scoping", "ready", "in-build", "blocked", "shipped"] as const;
export const TASK_STATUSES = ["todo", "in-progress", "review", "done"] as const;
export const TASK_SOURCES = ["manual", "sync"] as const;
export const ALERT_TYPES = ["overlap", "risk", "blocker", "missing-owner", "duplicate", "stale"] as const;
export const DUPLICATE_CATEGORIES = ["projects", "ideas", "build-items", "automations"] as const;

export const companyRecordsTable = pgTable("company_records", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  source: text("source").notNull(),
  classification: text("classification", { enum: CLASSIFICATIONS }).notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decisionsTable = pgTable("decisions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  context: text("context").notNull(),
  status: text("status", { enum: DECISION_STATUSES }).notNull().default("open"),
  owner: text("owner"),
  approvalRoute: text("approval_route", { enum: APPROVAL_ROUTES }).notNull(),
  risk: text("risk", { enum: REGISTRY_RISK_LEVELS }).notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  system: text("system").notNull(),
  status: text("status", { enum: AUTOMATION_STATUSES }).notNull(),
  owner: text("owner"),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const duplicateRisksTable = pgTable("duplicate_risks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  similarity: integer("similarity").notNull(),
  overlappingItems: jsonb("overlapping_items").$type<string[]>().notNull().default([]),
  reason: text("reason").notNull(),
  sourceRecords: jsonb("source_records").$type<string[]>().notNull().default([]),
  affectedOwners: jsonb("affected_owners").$type<string[]>().notNull().default([]),
  risk: text("risk", { enum: REGISTRY_RISK_LEVELS }).notNull(),
  recommendation: text("recommendation").notNull(),
  approvalRoute: text("approval_route", { enum: APPROVAL_ROUTES }).notNull(),
  category: text("category", { enum: DUPLICATE_CATEGORIES }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ALERT_TYPES }).notNull(),
  message: text("message").notNull(),
  risk: text("risk", { enum: REGISTRY_RISK_LEVELS }).notNull(),
  source: text("source").notNull(),
  createdAt: text("event_date").notNull(),
});

export const buildItemsTable = pgTable("build_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  readiness: integer("readiness").notNull().default(0),
  status: text("status", { enum: BUILD_ITEM_STATUSES }).notNull(),
  owner: text("owner"),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectTasksTable = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  owner: text("owner"),
  status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
  dueDate: text("due_date"),
  source: text("source", { enum: TASK_SOURCES }).notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type CompanyRecordRow = typeof companyRecordsTable.$inferSelect;
export type DecisionRow = typeof decisionsTable.$inferSelect;
export type AutomationRow = typeof automationsTable.$inferSelect;
export type DuplicateRiskRow = typeof duplicateRisksTable.$inferSelect;
export type AlertRow = typeof alertsTable.$inferSelect;
export type BuildItemRow = typeof buildItemsTable.$inferSelect;
export type ProjectTaskRow = typeof projectTasksTable.$inferSelect;
