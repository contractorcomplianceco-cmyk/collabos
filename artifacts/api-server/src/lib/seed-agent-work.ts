import { db, agentWorkItemsTable, type AgentWorkEvent, type AgentWorkItemRow } from "@workspace/db";
import { logger } from "./logger";
import { historyId, historyTimestamp } from "./recommendation-approval";

const SEED_AGENT_WORK = [
  {
    title: "Review live integration readiness",
    description: "Confirm pre-integration shared state, monitoring, and request routing are stable before connecting Zoho, WhatsApp, or Gemini.",
    requestType: "integration-prep" as const,
    priority: "high" as const,
    affectedModule: "Integrations",
    desiredOutcome: "Rose and Carmen can approve the integration sequence with a clear checklist.",
    status: "triaged" as const,
    owner: "Carmen Vega",
    approvalRoute: "both" as const,
    risk: "high" as const,
    source: "CollabOS",
    verificationSteps: ["Confirm API health", "Confirm uptime monitor", "Confirm no runtime seed-backed modules remain"],
    agentNotes: "Seeded as an example of a pre-integration agent task.",
  },
  {
    title: "Create first approved agent handoff",
    description: "Use this queue to hand Cursor one specific fix with desired outcome, approval route, and verification expectations.",
    requestType: "ops" as const,
    priority: "medium" as const,
    affectedModule: "Agent Queue",
    desiredOutcome: "Rose can submit a work item that becomes executable only after approval.",
    status: "new" as const,
    owner: "Rose Almeida",
    approvalRoute: "rose" as const,
    risk: "medium" as const,
    source: "CollabOS",
    verificationSteps: ["Create request", "Approve for agent", "Agent updates status and evidence"],
    agentNotes: "",
  },
];

export function serializeAgentWorkItem(row: AgentWorkItemRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requestType: row.requestType,
    priority: row.priority,
    affectedModule: row.affectedModule,
    desiredOutcome: row.desiredOutcome,
    status: row.status,
    owner: row.owner,
    approvalRoute: row.approvalRoute,
    risk: row.risk,
    source: row.source,
    relatedIntakeId: row.relatedIntakeId,
    relatedRecommendationId: row.relatedRecommendationId,
    relatedProjectId: row.relatedProjectId,
    branchName: row.branchName,
    commitSha: row.commitSha,
    mergeRequestUrl: row.mergeRequestUrl,
    verificationSteps: row.verificationSteps,
    agentNotes: row.agentNotes,
    finalOutcome: row.finalOutcome,
    events: row.events,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function agentWorkEvent(actor: string, action: string, note?: string): AgentWorkEvent {
  return { id: historyId("awe"), timestamp: historyTimestamp(), actor, action, ...(note ? { note } : {}) };
}

export async function seedAgentWorkIfEmpty(): Promise<void> {
  const existing = await db.select({ id: agentWorkItemsTable.id }).from(agentWorkItemsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(agentWorkItemsTable).values(
    SEED_AGENT_WORK.map((item) => ({
      ...item,
      events: [agentWorkEvent("Rose OS", "Agent work item seeded", item.desiredOutcome)],
    })),
  );
  logger.info({ count: SEED_AGENT_WORK.length }, "Seeded agent work queue");
}
