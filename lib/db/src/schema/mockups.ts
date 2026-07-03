import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const MOCKUP_STATUSES = [
  "draft",
  "needs_rose_review",
  "needs_carmen_review",
  "needs_both_review",
  "approved_for_build",
  "sent_back",
  "archived",
] as const;
export type MockupStatus = (typeof MOCKUP_STATUSES)[number];

export const MOCKUP_SOURCE_TYPES = [
  "intake_item",
  "idea",
  "build_request",
  "mind_meld_item",
  "scratch",
] as const;
export type MockupSourceType = (typeof MOCKUP_SOURCE_TYPES)[number];

export const mockupBriefSchema = z.object({
  productName: z.string().default(""),
  audience: z.string().default(""),
  mainGoal: z.string().default(""),
  userRoles: z.string().default(""),
  keyWorkflows: z.string().default(""),
  mustHaveFeatures: z.string().default(""),
  dataNeeded: z.string().default(""),
  privacyRules: z.string().default(""),
  brandDirection: z.string().default(""),
  visualFeel: z.string().default(""),
  approvalNeeded: z.enum(["rose", "carmen", "both", "none"]).default("both"),
  buildReadiness: z.enum(["not_ready", "needs_detail", "almost_ready", "build_ready"]).default("not_ready"),
});
export type MockupBrief = z.infer<typeof mockupBriefSchema>;

export const mockupScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string().default(""),
  blocks: z.array(z.string()).default([]),
});
export type MockupScreen = z.infer<typeof mockupScreenSchema>;

export const visualDirectionSchema = z.object({
  mood: z.string().default(""),
  colorDirection: z.string().default(""),
  layoutDensity: z.string().default(""),
  buttonStyle: z.string().default(""),
  cardStyle: z.string().default(""),
  navigationStyle: z.string().default(""),
  motionLevel: z.string().default(""),
  overallFeel: z.string().default(""),
});
export type VisualDirection = z.infer<typeof visualDirectionSchema>;

export const mockupsTable = pgTable("mockups", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceType: text("source_type", { enum: MOCKUP_SOURCE_TYPES }).notNull().default("scratch"),
  sourceItemId: text("source_item_id"),
  sourceSummary: text("source_summary"),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  ownerName: text("owner_name").notNull(),
  status: text("status", { enum: MOCKUP_STATUSES }).notNull().default("draft"),
  brief: jsonb("brief").$type<MockupBrief>().notNull(),
  screens: jsonb("screens").$type<MockupScreen[]>().notNull().default([]),
  visualDirection: jsonb("visual_direction").$type<VisualDirection>().notNull(),
  statusNote: text("status_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMockupSchema = createInsertSchema(mockupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMockup = z.infer<typeof insertMockupSchema>;
export type Mockup = typeof mockupsTable.$inferSelect;
