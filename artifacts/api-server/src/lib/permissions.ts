import type { UserRole } from "@workspace/db";

export const PERMISSIONS = [
  "view_dashboard",
  "external_intake_view",
  "external_intake_act",
  "review_queue_view",
  "review_queue_approve",
  "mind_meld_access",
  "sensitive_view",
  "mockup_studio_view",
  "mockup_studio_edit",
  "mockup_approve_rose",
  "mockup_approve_carmen",
  "idea_constellation_view",
  "brain_suggest",
  "brain_approve",
  "build_prompt_generate",
  "integration_settings_manage",
  "agent_work_view",
  "agent_work_manage",
  "user_management",
  "system_settings",
  "audit_logs_view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ALL,
  rose_admin: [
    "view_dashboard",
    "external_intake_view",
    "external_intake_act",
    "review_queue_view",
    "review_queue_approve",
    "mind_meld_access",
    "sensitive_view",
    "mockup_studio_view",
    "mockup_studio_edit",
    "mockup_approve_rose",
    "idea_constellation_view",
    "brain_suggest",
    "brain_approve",
    "build_prompt_generate",
    "integration_settings_manage",
    "agent_work_view",
    "agent_work_manage",
    "audit_logs_view",
  ],
  carmen_admin: [
    "view_dashboard",
    "external_intake_view",
    "external_intake_act",
    "review_queue_view",
    "review_queue_approve",
    "mind_meld_access",
    "sensitive_view",
    "mockup_studio_view",
    "mockup_studio_edit",
    "mockup_approve_carmen",
    "idea_constellation_view",
    "brain_suggest",
    "brain_approve",
    "build_prompt_generate",
    "integration_settings_manage",
    "agent_work_view",
    "agent_work_manage",
    "audit_logs_view",
  ],
  leadership_reviewer: [
    "view_dashboard",
    "external_intake_view",
    "external_intake_act",
    "review_queue_view",
    "review_queue_approve",
    "sensitive_view",
    "mockup_studio_view",
    "mockup_studio_edit",
    "idea_constellation_view",
    "brain_suggest",
    "build_prompt_generate",
    "agent_work_view",
    "agent_work_manage",
  ],
  contributor: [
    "view_dashboard",
    "external_intake_view",
    "external_intake_act",
    "review_queue_view",
    "mockup_studio_view",
    "mockup_studio_edit",
    "idea_constellation_view",
    "brain_suggest",
    "build_prompt_generate",
  ],
  viewer: [
    "view_dashboard",
    "external_intake_view",
    "review_queue_view",
    "mockup_studio_view",
    "idea_constellation_view",
  ],
  guest: ["view_dashboard"],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}
