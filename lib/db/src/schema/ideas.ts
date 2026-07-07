import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const IDEA_STATUSES = [
  "draft-idea",
  "related-to-existing",
  "needs-research",
  "needs-carmen-review",
  "needs-rose-review",
  "approved-for-build",
  "parked",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_APPROVAL_ROUTES = ["rose", "carmen", "both", "none"] as const;
export type IdeaApprovalRoute = (typeof IDEA_APPROVAL_ROUTES)[number];

export const ideasTable = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status", { enum: IDEA_STATUSES }).notNull().default("draft-idea"),
  momentum: integer("momentum").notNull().default(50),
  cluster: text("cluster"),
  benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
  risks: jsonb("risks").$type<string[]>().notNull().default([]),
  dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
  approvalRoute: text("approval_route", { enum: IDEA_APPROVAL_ROUTES }).notNull().default("carmen"),
  createdAt: text("created_at").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIdeaSchema = createInsertSchema(ideasTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideasTable.$inferSelect;
