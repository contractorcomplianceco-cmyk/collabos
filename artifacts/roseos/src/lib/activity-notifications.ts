import type { Role } from "@/types";
import { canApprove, canAccessMindMeld } from "@/lib/helpers";

export const ACTIVITY_MODULES = [
  "dashboard",
  "review-queue",
  "mind-meld",
  "agent-queue",
  "external-intake",
  "project-tasks",
  "carmen-path",
  "projects",
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

export interface ActivityItem {
  id: string;
  module: ActivityModule;
  label: string;
  detail: string;
  href: string;
  count: number;
  tone: "rose" | "amber" | "sky" | "violet" | "emerald" | "slate";
}

export interface ActivityInput {
  role: Role;
  userName: string;
  moduleLastSeen: Record<string, string>;
  lastLoginAt: string | null;
  recommendations: Array<{
    id: string;
    recommendation: string;
    status: string;
    requiredApprover: string;
    updatedAt?: string;
    createdAt?: string;
    approvals?: { rose: boolean; carmen: boolean };
    history?: Array<{ actor: string; action: string; timestamp: string }>;
  }>;
  intakeItems: Array<{
    id: string;
    cleanedSummary: string;
    status: string;
    receivedAt: string;
  }>;
  meldTimeline: Array<{
    id: string;
    itemTitle: string;
    timestamp: string;
    finalized: boolean;
    needs: string | null;
  }>;
  agentWorkItems: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: string;
    attachmentCount?: number;
    events: Array<{ timestamp: string; action?: string }>;
  }>;
  projectTasks: Array<{
    id: string;
    title: string;
    owner: string | null;
    status: string;
    createdAt?: string;
    completedAt?: string | null;
  }>;
  blockers?: Array<{
    id: string;
    title: string;
    age: number;
  }>;
}

function parseTs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function sinceTs(module: ActivityModule, moduleLastSeen: Record<string, string>, lastLoginAt: string | null): number {
  return parseTs(moduleLastSeen[module]) || parseTs(lastLoginAt) || 0;
}

function isNewer(ts: string | undefined, since: number): boolean {
  if (!ts) return false;
  return parseTs(ts) > since;
}

export function pathToActivityModule(path: string): ActivityModule | null {
  if (path === "/" || path === "") return "dashboard";
  const key = path.replace(/^\//, "").split("/")[0];
  const map: Record<string, ActivityModule> = {
    "review-queue": "review-queue",
    "mind-meld": "mind-meld",
    "agent-queue": "agent-queue",
    "external-intake": "external-intake",
    "project-tasks": "project-tasks",
    "carmen-path": "carmen-path",
    projects: "projects",
  };
  return map[key] ?? null;
}

export function computeActivitySinceLastVisit(input: ActivityInput): ActivityItem[] {
  const { role, userName, moduleLastSeen, lastLoginAt } = input;
  const isRose = role === "Rose" || role === "Admin";
  const isCarmen = role === "Carmen" || role === "Admin";
  const items: ActivityItem[] = [];

  const recSince = sinceTs("review-queue", moduleLastSeen, lastLoginAt);
  const newRecs = input.recommendations.filter((r) => {
    if (r.status !== "pending") return false;
    const ts = r.updatedAt ?? r.createdAt;
    if (!isNewer(ts, recSince)) return false;
    if (!canApprove(role, r.requiredApprover as Parameters<typeof canApprove>[1])) return false;
    if (r.requiredApprover === "both") {
      if (role === "Rose") return !r.approvals?.rose;
      if (role === "Carmen") return !r.approvals?.carmen;
    }
    return true;
  });
  if (newRecs.length > 0) {
    items.push({
      id: "since-recs",
      module: "review-queue",
      label: `${newRecs.length} item${newRecs.length === 1 ? "" : "s"} waiting on you`,
      detail: newRecs[0].recommendation,
      href: "/review-queue",
      count: newRecs.length,
      tone: "rose",
    });
  }

  // Rose signed off (or Carmen) since last visit — useful for the other person
  const signoffs = input.recommendations.filter((r) => {
    const ts = r.updatedAt ?? r.createdAt;
    if (!isNewer(ts, recSince)) return false;
    if (isCarmen && r.approvals?.rose) return true;
    if (isRose && r.approvals?.carmen) return true;
    return false;
  });
  if (signoffs.length > 0) {
    const who = isCarmen ? "Rose" : "Carmen";
    items.push({
      id: "since-signoff",
      module: "review-queue",
      label: `${who} signed off on ${signoffs.length} item${signoffs.length === 1 ? "" : "s"}`,
      detail: signoffs[0].recommendation,
      href: isCarmen ? "/carmen-path" : "/review-queue",
      count: signoffs.length,
      tone: "emerald",
    });
  }

  const intakeSince = sinceTs("external-intake", moduleLastSeen, lastLoginAt);
  const newIntake = input.intakeItems.filter(
    (it) => (it.status === "new" || it.status === "needs_review") && isNewer(it.receivedAt, intakeSince),
  );
  if (newIntake.length > 0) {
    items.push({
      id: "since-intake",
      module: "external-intake",
      label: `${newIntake.length} incoming message${newIntake.length === 1 ? "" : "s"}`,
      detail: newIntake[0].cleanedSummary,
      href: "/external-intake",
      count: newIntake.length,
      tone: "sky",
    });
  }

  if (canAccessMindMeld(role)) {
    const meldSince = sinceTs("mind-meld", moduleLastSeen, lastLoginAt);
    const newMeld = input.meldTimeline.filter((e) => {
      if (e.finalized) return false;
      if (!isNewer(e.timestamp, meldSince)) return false;
      if (!e.needs || e.needs === "none") return true;
      if (e.needs === "both") return isRose || isCarmen;
      if (e.needs === "rose") return isRose;
      if (e.needs === "carmen") return isCarmen;
      return false;
    });
    if (newMeld.length > 0) {
      items.push({
        id: "since-meld",
        module: "mind-meld",
        label: `${newMeld.length} Mind Meld update${newMeld.length === 1 ? "" : "s"}`,
        detail: newMeld[0].itemTitle,
        href: "/mind-meld",
        count: newMeld.length,
        tone: "violet",
      });
    }
  }

  const agentSince = sinceTs("agent-queue", moduleLastSeen, lastLoginAt);
  const newAgent = input.agentWorkItems.filter((w) => {
    const latestEvent = w.events[w.events.length - 1]?.timestamp;
    const ts = latestEvent ?? w.updatedAt;
    return isNewer(ts, agentSince) && w.status !== "done" && w.status !== "rejected";
  });
  if (newAgent.length > 0) {
    items.push({
      id: "since-agent",
      module: "agent-queue",
      label: `${newAgent.length} Cursor request update${newAgent.length === 1 ? "" : "s"}`,
      detail: newAgent[0].title,
      href: "/agent-queue",
      count: newAgent.length,
      tone: "amber",
    });
  }

  const withAttachments = input.agentWorkItems.filter(
    (w) =>
      (w.attachmentCount ?? 0) > 0 &&
      w.status !== "done" &&
      w.status !== "rejected" &&
      isNewer(w.updatedAt, agentSince),
  );
  if (withAttachments.length > 0) {
    items.push({
      id: "since-attachments",
      module: "agent-queue",
      label: `Rose attached files on ${withAttachments.length} request${withAttachments.length === 1 ? "" : "s"}`,
      detail: withAttachments[0].title,
      href: "/carmen-path",
      count: withAttachments.length,
      tone: "rose",
    });
  }

  const taskSince = sinceTs("project-tasks", moduleLastSeen, lastLoginAt);
  const firstName = userName.split(/\s+/)[0]?.toLowerCase() ?? "";
  const newTasks = input.projectTasks.filter((t) => {
    if (t.status === "done") return false;
    if (!isNewer(t.createdAt, taskSince)) return false;
    if (!t.owner) return true;
    return t.owner.toLowerCase().includes(firstName);
  });
  if (newTasks.length > 0) {
    items.push({
      id: "since-tasks",
      module: "project-tasks",
      label: `${newTasks.length} project task${newTasks.length === 1 ? "" : "s"}`,
      detail: newTasks[0].title,
      href: "/carmen-path",
      count: newTasks.length,
      tone: "emerald",
    });
  }

  // Carmen completed a task — useful for Rose
  if (isRose) {
    const completed = input.projectTasks.filter((t) => {
      if (t.status !== "done") return false;
      if (!isNewer(t.completedAt ?? undefined, taskSince)) return false;
      return (t.owner ?? "").toLowerCase().includes("carmen");
    });
    if (completed.length > 0) {
      items.push({
        id: "since-carmen-done",
        module: "project-tasks",
        label: `Carmen completed ${completed.length} task${completed.length === 1 ? "" : "s"}`,
        detail: completed[0].title,
        href: "/project-tasks",
        count: completed.length,
        tone: "violet",
      });
    }
  }

  const newBlockers = (input.blockers ?? []).filter((b) => b.age <= 1);
  if (newBlockers.length > 0) {
    items.push({
      id: "since-blockers",
      module: "projects",
      label: `${newBlockers.length} new blocker${newBlockers.length === 1 ? "" : "s"}`,
      detail: newBlockers[0].title,
      href: "/carmen-path",
      count: newBlockers.length,
      tone: "amber",
    });
  }

  return items;
}

export function formatLastSeen(moduleLastSeen: Record<string, string>, lastLoginAt: string | null): string | null {
  const dashboardSeen = moduleLastSeen.dashboard ?? lastLoginAt;
  if (!dashboardSeen) return null;
  const t = parseTs(dashboardSeen);
  if (!t) return null;
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
