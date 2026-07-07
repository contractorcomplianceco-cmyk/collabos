import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const INTAKE_SOURCES = ["zoho_cliq", "whatsapp", "manual"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

export const INTAKE_DETECTED_TYPES = [
  "idea",
  "todo",
  "build_request",
  "decision_candidate",
  "blocker",
  "question",
  "process_update",
  "crm_or_zoho_request",
  "automation_request",
  "rose_carmen_mind_meld",
  "company_brain_update_suggestion",
  "sensitive_private_item",
  "ignore_or_noise",
] as const;
export type IntakeDetectedType = (typeof INTAKE_DETECTED_TYPES)[number];

export const INTAKE_DESTINATIONS = [
  "mind-meld",
  "review-queue",
  "command-center-task",
  "idea-backlog",
  "build-registry",
  "requirements-registry",
  "automation-registry",
  "decision-log",
  "company-brain-update",
  "no-action",
] as const;
export type IntakeDestination = (typeof INTAKE_DESTINATIONS)[number];

export const INTAKE_SENSITIVITIES = [
  "normal",
  "private_leadership",
  "client_sensitive",
  "hr_sensitive",
  "financial_sensitive",
  "legal_sensitive",
  "unclear",
] as const;
export type IntakeSensitivity = (typeof INTAKE_SENSITIVITIES)[number];

export const INTAKE_REVIEW_OWNERS = [
  "Rose",
  "Carmen",
  "Rose and Carmen",
  "Assigned team member",
  "Unassigned",
] as const;
export type IntakeReviewOwner = (typeof INTAKE_REVIEW_OWNERS)[number];

export const INTAKE_STATUSES = [
  "new",
  "needs_review",
  "routed",
  "approved",
  "rejected",
  "archived",
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_DUPLICATE_RISKS = ["none", "possible", "likely"] as const;
export type IntakeDuplicateRisk = (typeof INTAKE_DUPLICATE_RISKS)[number];

export const intakeAuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
});

export const intakeItemsTable = pgTable("intake_items", {
  id: serial("id").primaryKey(),
  source: text("source", { enum: INTAKE_SOURCES }).notNull(),
  sourceChannel: text("source_channel").notNull(),
  senderName: text("sender_name").notNull(),
  senderHandle: text("sender_handle").notNull(),
  senderRole: text("sender_role"),
  receivedAt: text("received_at").notNull(),
  rawMessage: text("raw_message").notNull(),
  cleanedSummary: text("cleaned_summary").notNull(),
  detectedType: text("detected_type", { enum: INTAKE_DETECTED_TYPES }).notNull(),
  suggestedDestination: text("suggested_destination", { enum: INTAKE_DESTINATIONS }).notNull(),
  sensitivity: text("sensitivity", { enum: INTAKE_SENSITIVITIES }).notNull(),
  reviewOwner: text("review_owner", { enum: INTAKE_REVIEW_OWNERS }).notNull(),
  status: text("status", { enum: INTAKE_STATUSES }).notNull().default("new"),
  duplicateRisk: text("duplicate_risk", { enum: INTAKE_DUPLICATE_RISKS }).notNull().default("none"),
  relatedProjectNames: jsonb("related_project_names").$type<string[]>().notNull().default([]),
  reviewerNotes: text("reviewer_notes").notNull().default(""),
  finalActionTaken: text("final_action_taken"),
  nextStep: text("next_step").notNull().default(""),
  classificationReason: text("classification_reason").notNull().default(""),
  auditLog: jsonb("audit_log").$type<z.infer<typeof intakeAuditEntrySchema>[]>().notNull().default([]),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIntakeItemSchema = createInsertSchema(intakeItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntakeItem = z.infer<typeof insertIntakeItemSchema>;
export type IntakeItemRow = typeof intakeItemsTable.$inferSelect;
