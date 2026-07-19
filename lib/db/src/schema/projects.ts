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

export const PROJECT_TYPES = ["demo", "live", "planning", "merged-cc-host"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

// --- Project Cleanup governance labels ---------------------------------------
// Every label uses "" (unset) as the default so newly imported rows start blank
// for review, per the cleanup workflow.
export const PROJECT_STAGES = ["", "Concept", "Prototype", "Build", "Internal", "Pilot", "Live", "Retiring", "Archive"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_FINAL_INTENTIONS = [
  "",
  "Staff cockpit",
  "Internal system",
  "Client portal",
  "Product for sale",
  "Partner room",
  "Investor room",
  "Temporary bridge",
  "Archive",
] as const;
export type ProjectFinalIntention = (typeof PROJECT_FINAL_INTENTIONS)[number];

export const PROJECT_CONFIDENCE = ["", "Exploratory", "Likely", "Confirmed", "Approved"] as const;
export type ProjectConfidence = (typeof PROJECT_CONFIDENCE)[number];

export const PROJECT_PRIORITIES = ["", "Critical now", "Important next", "Scheduled later", "Parked"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_SOURCE_OF_TRUTH = ["", "SoT", "Connected node", "Mirror", "Twin", "Unknown"] as const;
export type ProjectSourceOfTruth = (typeof PROJECT_SOURCE_OF_TRUTH)[number];

export const PROJECT_AGREEMENT_STATUSES = [
  "",
  "None",
  "Internal notice only",
  "Draft needed",
  "Drafting",
  "Ready to wire",
  "Wired",
  "Counsel review",
] as const;
export type ProjectAgreementStatus = (typeof PROJECT_AGREEMENT_STATUSES)[number];

// Which cleanup wave a project belongs to (0 = unassigned).
export const PROJECT_CLEANUP_WAVES = [0, 1, 2, 3] as const;

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
  projectType: text("project_type", { enum: PROJECT_TYPES }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  // --- Project Cleanup governance labels (blank until reviewed) ---
  stage: text("stage", { enum: PROJECT_STAGES }).notNull().default(""),
  finalIntention: text("final_intention", { enum: PROJECT_FINAL_INTENTIONS }).notNull().default(""),
  confidence: text("confidence", { enum: PROJECT_CONFIDENCE }).notNull().default(""),
  cleanupPriority: text("cleanup_priority", { enum: PROJECT_PRIORITIES }).notNull().default(""),
  sourceOfTruth: text("source_of_truth", { enum: PROJECT_SOURCE_OF_TRUTH }).notNull().default(""),
  agreementStatus: text("agreement_status", { enum: PROJECT_AGREEMENT_STATUSES }).notNull().default(""),
  doNotClaim: text("do_not_claim"),
  cleanupWave: integer("cleanup_wave").notNull().default(0),
  repoExists: text("repo_exists"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const BUILD_PLAN_PHASE_STATUSES = ["locked", "active", "complete"] as const;
export type BuildPlanPhaseStatus = (typeof BUILD_PLAN_PHASE_STATUSES)[number];

export type BuildPlanPhaseItem = {
  id: string;
  title: string;
  status: BuildPlanPhaseStatus;
  visibleProgress?: number;
  internalNotes?: string;
};

export const BUILD_PLAN_SOURCES = ["manual", "sync"] as const;
export type BuildPlanSource = (typeof BUILD_PLAN_SOURCES)[number];

export const projectBuildPlansTable = pgTable("project_build_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .unique(),
  summary: text("summary").notNull().default(""),
  currentPhaseId: text("current_phase_id").notNull().default("phase-1"),
  progress: integer("progress").notNull().default(0),
  phases: jsonb("phases").$type<BuildPlanPhaseItem[]>().notNull().default([]),
  roseInstructions: text("rose_instructions").notNull().default(""),
  carmenPlanNotes: text("carmen_plan_notes").notNull().default(""),
  source: text("source", { enum: BUILD_PLAN_SOURCES }).notNull().default("sync"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectHandoffsTable = pgTable("project_handoffs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
export type ProjectBuildPlanRow = typeof projectBuildPlansTable.$inferSelect;
export type ProjectHandoffRow = typeof projectHandoffsTable.$inferSelect;
