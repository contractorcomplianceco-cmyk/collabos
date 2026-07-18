import { db, recommendationsTable, projectsTable, type Recommendation } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    assignedTo: row.assignedTo ?? null,
    assignedToId: row.assignedToId ?? null,
    projectId: row.projectId ?? null,
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

const INTEGRATION_DECISION_CARDS = [
  {
    source: "Gemini",
    category: "final-decision" as const,
    recommendation:
      "Decide whether CCA should adopt Google Gemini for CollabOS / Rose AI reply assistance (prompt templates, drafts). Not live-wired — stamp only when ready to approve scope.",
    classification: "pending-approval" as const,
    risk: "medium" as const,
    requiredApprover: "rose" as const,
    /** Match only our dedicated card source, not incidental mentions elsewhere. */
    sourceExact: "Gemini",
  },
  {
    source: "Zoho CRM / WorkDrive",
    category: "final-decision" as const,
    recommendation:
      "Decide the Zoho CRM and WorkDrive integration path for CCA (what syncs, who owns fields, what stays manual). Not live-wired — pending Rose final decision before any connection goes live.",
    classification: "pending-approval" as const,
    risk: "high" as const,
    requiredApprover: "both" as const,
    sourceExact: "Zoho CRM / WorkDrive",
  },
];

/** Idempotent: ensure Gemini + Zoho CRM/WorkDrive pending Final-decision cards exist for Rose to stamp later. */
export async function ensurePendingIntegrationDecisionCards(): Promise<void> {
  const rows = await db
    .select({
      id: recommendationsTable.id,
      source: recommendationsTable.source,
      recommendation: recommendationsTable.recommendation,
      status: recommendationsTable.status,
      category: recommendationsTable.category,
      projectId: recommendationsTable.projectId,
    })
    .from(recommendationsTable);

  const projects = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable);
  const crmProject =
    projects.find((p) => /crm architecture/i.test(p.name)) ??
    projects.find((p) => /qualifierconnect/i.test(p.name)) ??
    projects.find((p) => /document collection/i.test(p.name));
  const geminiProject =
    projects.find((p) => /gemini/i.test(p.name)) ??
    projects.find((p) => /^collabos$/i.test(p.name)) ??
    projects.find((p) => /collabos/i.test(p.name));

  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  let inserted = 0;

  for (const card of INTEGRATION_DECISION_CARDS) {
    const existing = rows.find(
      (r) => r.source === card.sourceExact && r.category === "final-decision",
    );
    if (existing) {
      const linkId = card.sourceExact.startsWith("Zoho") ? crmProject?.id : geminiProject?.id;
      if (linkId && !existing.projectId) {
        await db.update(recommendationsTable).set({ projectId: linkId }).where(eq(recommendationsTable.id, existing.id));
      }
      continue;
    }

    const projectId = card.sourceExact.startsWith("Zoho") ? crmProject?.id ?? null : geminiProject?.id ?? null;
    await db.insert(recommendationsTable).values({
      source: card.source,
      category: card.category,
      recommendation: card.recommendation,
      classification: card.classification,
      risk: card.risk,
      requiredApprover: card.requiredApprover,
      status: "pending",
      approvals: { rose: false, carmen: false },
      projectId,
      history: [
        {
          id: `rh-int-${card.sourceExact.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          timestamp: now,
          actor: "Rose OS",
          action: "Pending final decision card created (not live-wired, not approved).",
        },
      ],
      createdByName: "Rose OS",
    });
    inserted += 1;
  }

  if (inserted > 0) {
    logger.info({ inserted }, "Ensured pending Gemini / Zoho Final-decision cards");
  }
}
