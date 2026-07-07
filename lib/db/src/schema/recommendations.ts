import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const RECOMMENDATION_CATEGORIES = [
  "duplicate",
  "team-pulse",
  "sop-update",
  "automation",
  "mockup-prompt",
  "market",
  "mind-meld-handoff",
  "company-record",
  "sensitive",
  "final-decision",
  "external-intake",
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export const RECOMMENDATION_CLASSIFICATIONS = [
  "documented-fact",
  "user-update",
  "ai-recommendation",
  "draft-idea",
  "pending-approval",
  "approved-decision",
  "sensitive",
] as const;
export type RecommendationClassification = (typeof RECOMMENDATION_CLASSIFICATIONS)[number];

export const RECOMMENDATION_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RecommendationRiskLevel = (typeof RECOMMENDATION_RISK_LEVELS)[number];

export const RECOMMENDATION_APPROVAL_ROUTES = ["rose", "carmen", "both", "none"] as const;
export type RecommendationApprovalRoute = (typeof RECOMMENDATION_APPROVAL_ROUTES)[number];

export const RECOMMENDATION_STATUSES = ["pending", "approved", "rejected", "needs-revision"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const recommendationHistoryEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
});
export type RecommendationHistoryEntry = z.infer<typeof recommendationHistoryEntrySchema>;

export const recommendationApprovalsSchema = z.object({
  rose: z.boolean(),
  carmen: z.boolean(),
});
export type RecommendationApprovals = z.infer<typeof recommendationApprovalsSchema>;

export const recommendationsTable = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  category: text("category", { enum: RECOMMENDATION_CATEGORIES }).notNull(),
  recommendation: text("recommendation").notNull(),
  classification: text("classification", { enum: RECOMMENDATION_CLASSIFICATIONS }).notNull(),
  risk: text("risk", { enum: RECOMMENDATION_RISK_LEVELS }).notNull(),
  requiredApprover: text("required_approver", { enum: RECOMMENDATION_APPROVAL_ROUTES }).notNull(),
  status: text("status", { enum: RECOMMENDATION_STATUSES }).notNull().default("pending"),
  approvals: jsonb("approvals").$type<RecommendationApprovals>().notNull().default({ rose: false, carmen: false }),
  history: jsonb("history").$type<RecommendationHistoryEntry[]>().notNull().default([]),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendationsTable.$inferSelect;
