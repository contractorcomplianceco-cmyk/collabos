import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { RECOMMENDATION_APPROVAL_ROUTES, RECOMMENDATION_RISK_LEVELS } from "./recommendations";

export const AGENT_WORK_TYPES = ["bug", "fix", "improvement", "ops", "question", "integration-prep"] as const;
export type AgentWorkType = (typeof AGENT_WORK_TYPES)[number];

export const AGENT_WORK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type AgentWorkPriority = (typeof AGENT_WORK_PRIORITIES)[number];

export const AGENT_WORK_STATUSES = [
  "new",
  "triaged",
  "approved-for-agent",
  "in-progress",
  "blocked",
  "ready-for-review",
  "done",
  "rejected",
] as const;
export type AgentWorkStatus = (typeof AGENT_WORK_STATUSES)[number];

export const agentWorkEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  note: z.string().optional(),
});
export type AgentWorkEvent = z.infer<typeof agentWorkEventSchema>;

export const agentWorkItemsTable = pgTable("agent_work_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requestType: text("request_type", { enum: AGENT_WORK_TYPES }).notNull(),
  priority: text("priority", { enum: AGENT_WORK_PRIORITIES }).notNull().default("medium"),
  affectedModule: text("affected_module").notNull(),
  desiredOutcome: text("desired_outcome").notNull(),
  status: text("status", { enum: AGENT_WORK_STATUSES }).notNull().default("new"),
  owner: text("owner"),
  approvalRoute: text("approval_route", { enum: RECOMMENDATION_APPROVAL_ROUTES }).notNull().default("carmen"),
  risk: text("risk", { enum: RECOMMENDATION_RISK_LEVELS }).notNull().default("medium"),
  source: text("source").notNull().default("CollabOS"),
  relatedIntakeId: integer("related_intake_id"),
  relatedRecommendationId: integer("related_recommendation_id"),
  relatedProjectId: integer("related_project_id"),
  branchName: text("branch_name"),
  commitSha: text("commit_sha"),
  mergeRequestUrl: text("merge_request_url"),
  verificationSteps: jsonb("verification_steps").$type<string[]>().notNull().default([]),
  agentNotes: text("agent_notes").notNull().default(""),
  finalOutcome: text("final_outcome"),
  events: jsonb("events").$type<AgentWorkEvent[]>().notNull().default([]),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const agentWorkAttachmentsTable = pgTable("agent_work_attachments", {
  id: serial("id").primaryKey(),
  agentWorkItemId: integer("agent_work_item_id")
    .notNull()
    .references(() => agentWorkItemsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentWorkItemSchema = createInsertSchema(agentWorkItemsTable).omit({
  id: true,
  events: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentWorkItem = z.infer<typeof insertAgentWorkItemSchema>;
export type AgentWorkItemRow = typeof agentWorkItemsTable.$inferSelect;
export type AgentWorkAttachmentRow = typeof agentWorkAttachmentsTable.$inferSelect;
