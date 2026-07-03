import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mockupsTable, type MockupBrief, type MockupScreen, type VisualDirection } from "./mockups";
import { usersTable } from "./users";

export type MockupVersionContent = {
  brief: MockupBrief;
  screens: MockupScreen[];
  visualDirection: VisualDirection;
};

export const mockupVersionsTable = pgTable("mockup_versions", {
  id: serial("id").primaryKey(),
  mockupId: integer("mockup_id")
    .notNull()
    .references(() => mockupsTable.id, { onDelete: "cascade" }),
  versionName: text("version_name").notNull(),
  content: jsonb("content").$type<MockupVersionContent>().notNull(),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMockupVersionSchema = createInsertSchema(mockupVersionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMockupVersion = z.infer<typeof insertMockupVersionSchema>;
export type MockupVersion = typeof mockupVersionsTable.$inferSelect;
