/** Human-readable UI labels only — backend field names stay unchanged. */

export const HUMAN_TASK_STATUS: Record<string, string> = {
  todo: "To do",
  "in-progress": "In progress",
  review: "Needs review",
  done: "Done",
};

export const HUMAN_PROJECT_STATUS: Record<string, string> = {
  active: "Active",
  "at-risk": "At risk",
  blocked: "Blocked",
  stale: "Needs attention",
  complete: "Complete",
  planning: "Planning",
};

export const HUMAN_PROJECT_TYPE: Record<string, string> = {
  demo: "Demo",
  live: "Live app",
  planning: "Planning",
  "merged-cc-host": "Command Center",
};

export const HUMAN_BUILD_PLAN_PHASE: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  live_stable: "Live & stable",
  maintenance: "Maintenance mode",
  blocked: "Blocked",
};

export const HUMAN_AGENT_STATUS: Record<string, string> = {
  new: "New",
  triaged: "Sorted",
  "approved-for-agent": "Ready for Cursor",
  "in-progress": "In progress",
  blocked: "Blocked",
  "ready-for-review": "Ready for your review",
  done: "Done",
  rejected: "Declined",
};

export const HUMAN_REVIEW_STATUS: Record<string, string> = {
  pending: "Waiting on you",
  approved: "Approved",
  rejected: "Declined",
  "needs-revision": "Needs another look",
};

export const HUMAN_REVIEW_CATEGORY: Record<string, string> = {
  all: "All",
  duplicate: "Duplicate work",
  "team-pulse": "Team feedback",
  automation: "Automations",
  market: "Market signals",
  "mind-meld-handoff": "Mind Meld handoff",
  "final-decision": "Final decisions",
  "mockup-prompt": "Mockups",
  "external-intake": "Incoming messages",
};

export function humanLabel(map: Record<string, string>, key: string): string {
  return map[key] ?? key.replace(/_/g, " ").replace(/-/g, " ");
}
