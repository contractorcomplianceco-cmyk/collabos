import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const AUDIT_ACTIONS = [
  "login",
  "logout",
  "login_failed",
  "user_created",
  "user_updated",
  "user_deactivated",
  "user_activated",
  "role_changed",
  "password_reset",
  "intake_routed",
  "item_marked_sensitive",
  "item_approved",
  "item_rejected",
  "brain_update_suggested",
  "brain_update_approved",
  "build_prompt_generated",
  "mockup_created",
  "mockup_updated",
  "mockup_version_created",
  "mockup_status_changed",
  "mockup_approved",
  "mockup_rejected",
  "integration_setting_changed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  sourceArea: text("source_area").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
