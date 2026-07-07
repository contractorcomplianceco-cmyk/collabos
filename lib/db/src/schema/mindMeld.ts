import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const MIND_MELD_STATUSES = [
  "rose-thinking",
  "carmen-thinking",
  "ready-to-carmenfy",
  "ready-to-rosify",
  "with-carmen",
  "with-rose",
  "aligned",
  "decided",
] as const;
export type MindMeldStatus = (typeof MIND_MELD_STATUSES)[number];

export const ALIGNMENT_STATUSES = ["strong", "partial", "needs-clarity"] as const;
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number];

export const MIND_MELD_OWNERS = ["Rose", "Carmen"] as const;
export const PRIVACY_LEVELS = ["public", "internal", "private", "leadership-only"] as const;
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const THOUGHT_LAYERS = ["Vision", "Strategy", "Execution", "Experience", "Impact"] as const;

export const mindMeldHistoryEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
});

export const mindMeldItemsTable = pgTable("mind_meld_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  owner: text("owner", { enum: MIND_MELD_OWNERS }).notNull(),
  status: text("status", { enum: MIND_MELD_STATUSES }).notNull(),
  roseThoughts: text("rose_thoughts").notNull().default(""),
  carmenThoughts: text("carmen_thoughts").notNull().default(""),
  synthesis: text("synthesis").notNull().default(""),
  openQuestions: jsonb("open_questions").$type<string[]>().notNull().default([]),
  alignment: text("alignment", { enum: ALIGNMENT_STATUSES }).notNull().default("needs-clarity"),
  alignmentScore: integer("alignment_score").notNull().default(0),
  risk: text("risk", { enum: RISK_LEVELS }).notNull().default("medium"),
  privacy: text("privacy", { enum: PRIVACY_LEVELS }).notNull().default("leadership-only"),
  nextHandoff: text("next_handoff"),
  finalOutcome: text("final_outcome"),
  layers: jsonb("layers").$type<string[]>().notNull().default([]),
  focusAreas: jsonb("focus_areas").$type<string[]>().notNull().default([]),
  roseFeedback: jsonb("rose_feedback").$type<string[]>().notNull().default([]),
  carmenFeedback: jsonb("carmen_feedback").$type<string[]>().notNull().default([]),
  sensitive: boolean("sensitive").notNull().default(false),
  history: jsonb("history").$type<z.infer<typeof mindMeldHistoryEntrySchema>[]>().notNull().default([]),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const mindMeldHandoffsTable = pgTable("mind_meld_handoffs", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => mindMeldItemsTable.id, { onDelete: "cascade" }),
  itemTitle: text("item_title").notNull(),
  fromPerson: text("from_person", { enum: MIND_MELD_OWNERS }).notNull(),
  toPerson: text("to_person", { enum: MIND_MELD_OWNERS }).notNull(),
  layer: text("layer", { enum: THOUGHT_LAYERS }).notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const MIND_MELD_TIMELINE_TYPES = [
  "original-message",
  "rose-thought",
  "carmen-thought",
  "synthesis",
  "open-question",
  "routing-action",
  "decision-candidate",
  "approved-direction",
  "brain-update-suggestion",
  "build-request",
  "archived",
] as const;

export const MIND_MELD_TIMELINE_ACTORS = ["Rose", "Carmen", "Rose OS", "System"] as const;

export const mindMeldTimelineTable = pgTable("mind_meld_timeline", {
  id: serial("id").primaryKey(),
  itemTitle: text("item_title").notNull(),
  type: text("type", { enum: MIND_MELD_TIMELINE_TYPES }).notNull(),
  actor: text("actor", { enum: MIND_MELD_TIMELINE_ACTORS }).notNull(),
  text: text("text").notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  sensitive: boolean("sensitive").notNull().default(false),
  needs: text("needs"),
  readyTo: text("ready_to"),
  finalized: boolean("finalized").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const MIND_FEED_ACTORS = ["Rose", "Carmen", "Rose OS"] as const;

export const mindFeedTable = pgTable("mind_feed", {
  id: serial("id").primaryKey(),
  actor: text("actor", { enum: MIND_FEED_ACTORS }).notNull(),
  action: text("action").notNull(),
  layer: text("layer", { enum: THOUGHT_LAYERS }).notNull(),
  eventTimestamp: text("event_timestamp").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMindMeldItemSchema = createInsertSchema(mindMeldItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMindMeldItem = z.infer<typeof insertMindMeldItemSchema>;
export type MindMeldItemRow = typeof mindMeldItemsTable.$inferSelect;
export type MindMeldHandoffRow = typeof mindMeldHandoffsTable.$inferSelect;
export type MindMeldTimelineRow = typeof mindMeldTimelineTable.$inferSelect;
export type MindFeedRow = typeof mindFeedTable.$inferSelect;
