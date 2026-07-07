import { db, marketCompetitorsTable, marketSignalsTable, type MarketCompetitorRow, type MarketSignalRow } from "@workspace/db";
import { asc, desc } from "drizzle-orm";
import { logger } from "./logger";

const SEED_SIGNALS = [
  { source: "Acme Corp blog", dateFound: "2026-06-12", signalType: "new-product" as const, summary: "Acme Corp announced an AI-powered client intake assistant.", opportunity: "Differentiate on compliance depth.", risk: "high" as const, recommendedResponse: "Accelerate Business Services Hub intake.", reviewOwner: "rose" as const },
  { source: "Nexus Labs pricing page", dateFound: "2026-06-10", signalType: "pricing" as const, summary: "Nexus Labs moved to usage-based pricing.", opportunity: "Test tiered + usage hybrid.", risk: "medium" as const, recommendedResponse: "Model pricing scenarios.", reviewOwner: "rose" as const },
  { source: "Globex careers page", dateFound: "2026-06-08", signalType: "job-posting" as const, summary: "Globex hiring automation engineers for compliance.", opportunity: "Expand automation registry lead.", risk: "low" as const, recommendedResponse: "Highlight automation maturity.", reviewOwner: "carmen" as const },
  { source: "Industry report", dateFound: "2026-06-05", signalType: "trend" as const, summary: "Compliance buyers prioritizing unified client views.", opportunity: "Lead with Customer 360.", risk: "low" as const, recommendedResponse: "Promote Customer 360 build.", reviewOwner: "rose" as const },
  { source: "Public filing", dateFound: "2026-06-03", signalType: "compliance-opportunity" as const, summary: "New compliance reporting requirement taking effect.", opportunity: "Offer ready-made reporting templates.", risk: "medium" as const, recommendedResponse: "Scope compliance reporting feature.", reviewOwner: "both" as const },
];

const SEED_COMPETITORS = [
  { name: "Acme Corp", threat: "high" as const, trend: "up" as const, newsCount: 8, movement: 12, series: [20, 24, 22, 28, 32, 30, 36] },
  { name: "Nexus Labs", threat: "medium" as const, trend: "up" as const, newsCount: 5, movement: 5, series: [18, 19, 21, 20, 23, 24, 26] },
  { name: "Globex Inc", threat: "low" as const, trend: "down" as const, newsCount: 2, movement: -3, series: [30, 28, 27, 26, 24, 23, 22] },
  { name: "Emerging Entrant", threat: "watch" as const, trend: "flat" as const, newsCount: 1, movement: 1, series: [10, 11, 10, 12, 11, 12, 12] },
];

export function serializeMarketSignal(row: MarketSignalRow) {
  return {
    id: row.id,
    source: row.source,
    dateFound: row.dateFound,
    signalType: row.signalType,
    summary: row.summary,
    opportunity: row.opportunity,
    risk: row.risk,
    recommendedResponse: row.recommendedResponse,
    reviewOwner: row.reviewOwner,
  };
}

export function serializeMarketCompetitor(row: MarketCompetitorRow) {
  return {
    id: row.id,
    name: row.name,
    threat: row.threat,
    trend: row.trend,
    newsCount: row.newsCount,
    movement: row.movement,
    series: row.series,
  };
}

export async function seedMarketPulseIfEmpty(): Promise<void> {
  const existing = await db.select({ id: marketSignalsTable.id }).from(marketSignalsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(marketSignalsTable).values(SEED_SIGNALS);
  await db.insert(marketCompetitorsTable).values(SEED_COMPETITORS);
  logger.info({ signals: SEED_SIGNALS.length, competitors: SEED_COMPETITORS.length }, "Seeded market pulse data");
}
