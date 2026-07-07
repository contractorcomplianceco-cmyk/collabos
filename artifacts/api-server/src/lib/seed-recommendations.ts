import { db, recommendationsTable, type Recommendation } from "@workspace/db";
import { logger } from "./logger";

const SEED_RECOMMENDATIONS = [
  {
    source: "Duplicate Radar",
    category: "duplicate" as const,
    recommendation: "Merge Content Magic and AI Content Generator into one module.",
    classification: "ai-recommendation" as const,
    risk: "high" as const,
    requiredApprover: "rose" as const,
    history: [{ id: "rh-1", timestamp: "2026-06-16 09:00", actor: "Rose OS", action: "Recommendation created" }],
  },
  {
    source: "Team Pulse",
    category: "team-pulse" as const,
    recommendation: "Add a document collection SOP and a short training.",
    classification: "ai-recommendation" as const,
    risk: "medium" as const,
    requiredApprover: "carmen" as const,
    history: [{ id: "rh-2", timestamp: "2026-06-16 09:05", actor: "Rose OS", action: "Recommendation created" }],
  },
  {
    source: "Decisions",
    category: "final-decision" as const,
    recommendation: "Approve tiered + usage hybrid pricing for Services Hub.",
    classification: "pending-approval" as const,
    risk: "high" as const,
    requiredApprover: "both" as const,
    history: [{ id: "rh-3", timestamp: "2026-06-15 17:00", actor: "Rose OS", action: "Routed for decision" }],
  },
  {
    source: "Automation Registry",
    category: "automation" as const,
    recommendation: "Consolidate overlapping Zoho triggers.",
    classification: "ai-recommendation" as const,
    risk: "medium" as const,
    requiredApprover: "carmen" as const,
    history: [{ id: "rh-4", timestamp: "2026-06-15 12:00", actor: "Rose OS", action: "Recommendation created" }],
  },
  {
    source: "Market Pulse",
    category: "market" as const,
    recommendation: "Accelerate intake feature in response to Acme Corp.",
    classification: "ai-recommendation" as const,
    risk: "high" as const,
    requiredApprover: "rose" as const,
    history: [{ id: "rh-5", timestamp: "2026-06-14 11:00", actor: "Rose OS", action: "Recommendation created" }],
  },
  {
    source: "Mind Meld Room",
    category: "mind-meld-handoff" as const,
    recommendation: "Promote CRM consolidation playbook to proposed company record.",
    classification: "sensitive" as const,
    risk: "medium" as const,
    requiredApprover: "both" as const,
    history: [{ id: "rh-6", timestamp: "2026-06-13 15:00", actor: "Carmen", action: "Sent to review" }],
  },
];

function serializeRecommendation(row: Recommendation) {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    recommendation: row.recommendation,
    classification: row.classification,
    risk: row.risk,
    requiredApprover: row.requiredApprover,
    status: row.status,
    approvals: row.approvals,
    history: row.history,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { serializeRecommendation };

export async function seedRecommendationsIfEmpty(): Promise<void> {
  const existing = await db.select({ id: recommendationsTable.id }).from(recommendationsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(recommendationsTable).values(
    SEED_RECOMMENDATIONS.map((item) => ({
      ...item,
      status: "pending" as const,
      approvals: { rose: false, carmen: false },
      createdByName: "Rose OS",
    })),
  );
  logger.info({ count: SEED_RECOMMENDATIONS.length }, "Seeded review queue recommendations");
}
