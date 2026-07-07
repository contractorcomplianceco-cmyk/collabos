import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { intakeItemsTable } from "./intake";
import { usersTable } from "./users";

export const MEMORY_DESTINATIONS = [
  "private-rose-carmen-memory",
  "company-brain-suggestion",
  "project-note",
  "future-idea",
  "decision-candidate",
  "knowledge-gap-report",
] as const;
export type MemoryDestination = (typeof MEMORY_DESTINATIONS)[number];

export const MEMORY_CANDIDATE_STATUSES = ["proposed", "approved", "rejected"] as const;
export type MemoryCandidateStatus = (typeof MEMORY_CANDIDATE_STATUSES)[number];

export const memoryCandidatesTable = pgTable("memory_candidates", {
  id: serial("id").primaryKey(),
  sourceIntakeId: integer("source_intake_id").references(() => intakeItemsTable.id, { onDelete: "set null" }),
  summary: text("summary").notNull(),
  destination: text("destination", { enum: MEMORY_DESTINATIONS }).notNull(),
  status: text("status", { enum: MEMORY_CANDIDATE_STATUSES }).notNull().default("proposed"),
  sensitive: boolean("sensitive").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertMemoryCandidateSchema = createInsertSchema(memoryCandidatesTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertMemoryCandidate = z.infer<typeof insertMemoryCandidateSchema>;
export type MemoryCandidateRow = typeof memoryCandidatesTable.$inferSelect;
