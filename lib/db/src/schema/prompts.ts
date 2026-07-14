import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const PROMPT_INTENTS = [
  "handoff",
  "security",
  "design",
  "audit",
  "cursor-brief",
  "marketing",
  "general",
] as const;
export type PromptIntent = (typeof PROMPT_INTENTS)[number];

export const PROMPT_SHARED_WITH = ["rose", "carmen", "both"] as const;
export type PromptSharedWith = (typeof PROMPT_SHARED_WITH)[number];

export const promptsTable = pgTable("prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  intent: text("intent", { enum: PROMPT_INTENTS }).notNull().default("general"),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  sharedWith: text("shared_with"),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPromptSchema = createInsertSchema(promptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof promptsTable.$inferSelect;
