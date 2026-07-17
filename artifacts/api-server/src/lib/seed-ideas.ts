import { db, ideasTable, type Idea } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";

const SEED_IDEAS = [
  { title: "Collab OS vNext", description: "Merge Command Center insights with Rose Brain memory for proactive nudges.", submittedBy: "Rose Taylor", status: "needs-rose-review" as const, momentum: 92, cluster: "Platform", benefits: ["Proactive leadership signals", "Less manual review"], risks: ["Scope creep"], dependencies: ["Command Center Build"], approvalRoute: "both" as const, createdAt: "2026-06-12" },
  { title: "Personalization Engine", description: "Per-client personalization layer across services hub.", submittedBy: "Jordan Lee", status: "needs-research" as const, momentum: 78, cluster: "Growth", benefits: ["Higher conversion"], risks: ["Data privacy"], dependencies: ["Business Services Hub"], approvalRoute: "carmen" as const, createdAt: "2026-06-10" },
  { title: "Content Magic", description: "AI-assisted content drafting tied to Company Brain records.", submittedBy: "Jordan Lee", status: "draft-idea" as const, momentum: 61, cluster: "Growth", benefits: ["Faster content"], risks: ["Brand drift"], dependencies: [] as string[], approvalRoute: "rose" as const, createdAt: "2026-06-11" },
  { title: "AI Co-Pilot for Proposals", description: "Draft proposals from CRM + asset library.", submittedBy: "Tomas Beck", status: "related-to-existing" as const, momentum: 70, cluster: "Sales", benefits: ["Faster proposals"], risks: ["Pricing accuracy"], dependencies: ["Sales Asset Library", "QualifierConnect"], approvalRoute: "rose" as const, createdAt: "2026-06-08" },
  { title: "Smart Contract Manager", description: "Lifecycle tracking for compliance contracts.", submittedBy: "Dee Okafor", status: "needs-carmen-review" as const, momentum: 66, cluster: "Compliance", benefits: ["Risk reduction"], risks: ["Integration effort"], dependencies: ["Document Collection"], approvalRoute: "carmen" as const, createdAt: "2026-06-09" },
  { title: "Customer 360 Dashboard", description: "Single client view across CRM, services, and compliance.", submittedBy: "Priya Nair", status: "approved-for-build" as const, momentum: 85, cluster: "Platform", benefits: ["Unified client view"], risks: ["Data joins"], dependencies: ["CRM Architecture"], approvalRoute: "both" as const, createdAt: "2026-06-05" },
];

export function serializeIdea(row: Idea) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    submittedBy: row.submittedBy,
    status: row.status,
    momentum: row.momentum,
    cluster: row.cluster,
    benefits: row.benefits,
    risks: row.risks,
    dependencies: row.dependencies,
    approvalRoute: row.approvalRoute,
    createdAt: row.createdAt,
  };
}

export async function seedIdeasIfEmpty(): Promise<void> {
  const existing = await db.select({ id: ideasTable.id }).from(ideasTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(ideasTable).values(SEED_IDEAS);
  logger.info({ count: SEED_IDEAS.length }, "Seeded innovation lab ideas");
}
