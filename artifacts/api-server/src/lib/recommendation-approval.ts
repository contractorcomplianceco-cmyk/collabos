import type { UserRole } from "@workspace/db";
import type { RecommendationApprovalRoute } from "@workspace/db";

export function actorLabel(role: UserRole): string {
  switch (role) {
    case "rose_admin":
      return "Rose";
    case "carmen_admin":
      return "Carmen";
    case "super_admin":
      return "Admin";
    default:
      return role;
  }
}

export function canApproveRecommendation(role: UserRole, route: RecommendationApprovalRoute): boolean {
  if (route === "none") return false;
  if (role === "super_admin") return true;
  if (route === "rose") return role === "rose_admin";
  if (route === "carmen") return role === "carmen_admin";
  if (route === "both") return role === "rose_admin" || role === "carmen_admin";
  return false;
}

export function historyId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function historyTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}
