import { db, reportTemplatesTable, type ReportTemplateRow } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger";

const SEED_REPORTS = [
  {
    type: "Project Health Report",
    title: "Q2 Strategic Overview",
    reportDate: "2026-05-12",
    summary: "Overall portfolio is healthy with two high-risk projects needing leadership attention.",
    findings: ["8 active projects, 2 at-risk", "Document Collection blocked on ownership", "Services Hub blocked on pricing decision"],
    sourceData: ["Projects registry", "Blockers", "Decisions"],
    risks: ["Two high-risk projects near deadline", "Unowned compliance work"],
    recommendations: ["Assign Document Collection owner", "Resolve pricing decision this week"],
    decisionsNeeded: ["Pricing model for Services Hub"],
    owners: ["Rose Taylor", "Carmen Vega"],
    nextSteps: ["Leadership review Friday", "Re-baseline timelines"],
  },
  {
    type: "Growth Opportunity Report",
    title: "Innovation Pipeline",
    reportDate: "2026-05-10",
    summary: "Six ideas in pipeline; three cluster into a stronger platform opportunity.",
    findings: ["Collab OS vNext gaining momentum", "Customer 360 approved for build", "Content ideas overlap"],
    sourceData: ["Innovation Lab", "Duplicate Radar"],
    risks: ["Content idea duplication"],
    recommendations: ["Merge content ideas", "Sequence platform ideas"],
    decisionsNeeded: ["Prioritize Collab OS vNext"],
    owners: ["Rose Taylor"],
    nextSteps: ["Research personalization engine"],
  },
  {
    type: "Market Pulse Report",
    title: "Market Positioning",
    reportDate: "2026-05-09",
    summary: "Competitors are shifting toward AI-assisted compliance services.",
    findings: ["Acme Corp launched AI intake", "Nexus Labs adjusted pricing"],
    sourceData: ["Market Pulse (sample data)"],
    risks: ["Pricing pressure"],
    recommendations: ["Evaluate AI intake response"],
    decisionsNeeded: ["Pricing response"],
    owners: ["Rose Taylor"],
    nextSteps: ["Brief leadership on positioning"],
  },
];

export function serializeReportTemplate(row: ReportTemplateRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    date: row.reportDate,
    summary: row.summary,
    findings: row.findings,
    sourceData: row.sourceData,
    risks: row.risks,
    recommendations: row.recommendations,
    decisionsNeeded: row.decisionsNeeded,
    owners: row.owners,
    nextSteps: row.nextSteps,
  };
}

export async function seedReportTemplatesIfEmpty(): Promise<void> {
  const existing = await db.select({ id: reportTemplatesTable.id }).from(reportTemplatesTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(reportTemplatesTable).values(SEED_REPORTS);
  logger.info({ count: SEED_REPORTS.length }, "Seeded executive report templates");
}
