import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const FEEDBACK_TYPES = [
  "help-request",
  "blocker",
  "repeated-question",
  "confusion",
  "workload",
  "missing-docs",
  "training-need",
  "tool-friction",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_PRIVACY_LEVELS = ["public", "internal", "private", "leadership-only"] as const;
export const FEEDBACK_APPROVAL_ROUTES = ["rose", "carmen", "both", "none"] as const;

export const feedbackItemsTable = pgTable("feedback_items", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: FEEDBACK_TYPES }).notNull(),
  summary: text("summary").notNull(),
  submittedBy: text("submitted_by").notNull(),
  department: text("department").notNull(),
  privacy: text("privacy", { enum: FEEDBACK_PRIVACY_LEVELS }).notNull().default("internal"),
  supportNeed: text("support_need").notNull(),
  approvalRoute: text("approval_route", { enum: FEEDBACK_APPROVAL_ROUTES }).notNull().default("carmen"),
  count: integer("count").notNull().default(1),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeedbackItemSchema = createInsertSchema(feedbackItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFeedbackItem = z.infer<typeof insertFeedbackItemSchema>;
export type FeedbackItemRow = typeof feedbackItemsTable.$inferSelect;
