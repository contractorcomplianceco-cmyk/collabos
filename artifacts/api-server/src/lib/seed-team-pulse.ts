import { db, sentimentSignalsTable, sopsTable, type SentimentSignalRow, type SopRow } from "@workspace/db";
import { asc } from "drizzle-orm";
import { logger } from "./logger";

const SEED_SENTIMENT = [
  { team: "Product", score: 0.85, trend: "up" as const, theme: "Strong momentum on build" },
  { team: "Engineering", score: 0.62, trend: "flat" as const, theme: "Steady but watching workload" },
  { team: "Design", score: 0.75, trend: "up" as const, theme: "Energized by new direction" },
  { team: "Ops", score: 0.15, trend: "down" as const, theme: "Needs documentation support" },
  { team: "Sales", score: 0.43, trend: "flat" as const, theme: "Tooling friction in Zoho" },
];

const SEED_SOPS = [
  { title: "Client onboarding", area: "Services", status: "needs-update" as const, owner: "Dee Okafor" },
  { title: "Lead qualification", area: "Sales", status: "current" as const, owner: "Tomas Beck" },
  { title: "Document collection", area: "Compliance", status: "missing" as const, owner: null },
  { title: "Automation change control", area: "Systems", status: "current" as const, owner: "Carmen Vega" },
];

export function serializeSentimentSignal(row: SentimentSignalRow) {
  return { team: row.team, score: row.score, trend: row.trend, theme: row.theme };
}

export function serializeSop(row: SopRow) {
  return { id: row.id, title: row.title, area: row.area, status: row.status, owner: row.owner };
}

export async function seedTeamPulseExtrasIfEmpty(): Promise<void> {
  const existing = await db.select({ id: sentimentSignalsTable.id }).from(sentimentSignalsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(sentimentSignalsTable).values(SEED_SENTIMENT);
  await db.insert(sopsTable).values(SEED_SOPS);
  logger.info({ sentiment: SEED_SENTIMENT.length, sops: SEED_SOPS.length }, "Seeded team pulse sentiment and SOPs");
}
