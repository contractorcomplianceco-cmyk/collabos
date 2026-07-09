import {
  db,
  alertsTable,
  automationsTable,
  buildItemsTable,
  companyRecordsTable,
  decisionsTable,
  duplicateRisksTable,
  projectTasksTable,
  projectsTable,
  type AlertRow,
  type AutomationRow,
  type BuildItemRow,
  type CompanyRecordRow,
  type DecisionRow,
  type DuplicateRiskRow,
  type ProjectTaskRow,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { logger } from "./logger";

const SEED_COMPANY_RECORDS = [
  { title: "Client onboarding standard", type: "SOP", summary: "Approved onboarding sequence for CCA clients including intake, KYC, and welcome cadence.", source: "Company Brain", classification: "approved-decision" as const, keywords: ["onboarding", "client", "intake", "kyc"] },
  { title: "Qualifier scoring model", type: "Decision", summary: "Documented qualifier scoring thresholds and routing rules for QualifierConnect.", source: "Company Brain", classification: "approved-decision" as const, keywords: ["qualifier", "scoring", "leads", "routing", "stuck"] },
  { title: "CRM data ownership map", type: "Record", summary: "Defines which team owns each CRM module and field in Zoho.", source: "Company Brain", classification: "documented-fact" as const, keywords: ["crm", "owner", "zoho", "data"] },
  { title: "Document collection policy", type: "Policy", summary: "Compliance policy for collecting and storing client documents in WorkDrive.", source: "Company Brain", classification: "approved-decision" as const, keywords: ["document", "collection", "compliance", "workdrive"] },
  { title: "Automation change control", type: "SOP", summary: "Process for proposing, reviewing, and approving automation changes in CAG and Zoho.", source: "Company Brain", classification: "approved-decision" as const, keywords: ["automation", "change", "control", "review", "deploy"] },
  { title: "Brand voice guide", type: "Guide", summary: "Approved Rose OS brand voice and tone for client-facing content.", source: "Company Brain", classification: "approved-decision" as const, keywords: ["brand", "voice", "content", "marketing", "tone"] },
];

const SEED_DECISIONS = [
  { title: "Public launch domain for CollabOS Command Center", context: "Choose primary domain ahead of internal launch.", status: "open" as const, owner: "Rose Almeida", approvalRoute: "rose" as const, risk: "high" as const },
  { title: "CRM consolidation approach", context: "Merge or keep parallel Zoho modules.", status: "open" as const, owner: "Carmen Vega", approvalRoute: "carmen" as const, risk: "medium" as const },
  { title: "Pricing model for Business Services Hub", context: "Tiered vs usage-based pricing.", status: "open" as const, owner: "Rose Almeida", approvalRoute: "both" as const, risk: "high" as const },
  { title: "Automation registry ownership", context: "Who owns the registry long-term.", status: "deferred" as const, owner: "Sam Rivera", approvalRoute: "carmen" as const, risk: "low" as const },
];

const SEED_AUTOMATIONS = [
  { name: "Lead routing flow", system: "Zoho CRM", status: "live" as const, owner: "Sam Rivera", description: "Routes inbound leads to qualifier." },
  { name: "Document reminder cadence", system: "CAG", status: "draft" as const, owner: "Dee Okafor", description: "Reminds clients of missing docs." },
  { name: "Proposal draft trigger", system: "Zoho CRM", status: "proposed" as const, owner: "Tomas Beck", description: "Drafts proposal on stage change." },
  { name: "Sentiment digest", system: "Company Brain", status: "live" as const, owner: "Carmen Vega", description: "Weekly team pulse digest." },
];

const SEED_DUPLICATE_RISKS = [
  { title: "AI Content Generator vs Content Magic", similarity: 95, overlappingItems: ["Content Magic", "Marketing Command Center"], reason: "Both draft content from Company Brain records using AI.", sourceRecords: ["Brand voice guide", "Marketing Command Center"], affectedOwners: ["Jordan Lee"], risk: "high" as const, recommendation: "Merge into one content intelligence module.", approvalRoute: "rose" as const, category: "ideas" as const },
  { title: "Client Onboarding Redesign overlap", similarity: 83, overlappingItems: ["Business Services Hub", "Client onboarding SOP"], reason: "Two parallel onboarding redesigns in Services and Compliance.", sourceRecords: ["Client onboarding standard"], affectedOwners: ["Dee Okafor"], risk: "high" as const, recommendation: "Align both onto one onboarding standard.", approvalRoute: "both" as const, category: "projects" as const },
  { title: "AI-Powered Analytics duplication", similarity: 76, overlappingItems: ["Customer 360 Dashboard", "Command Center Build"], reason: "Two analytics surfaces planned over the same CRM data.", sourceRecords: ["CRM data ownership map"], affectedOwners: ["Priya Nair", "Carmen Vega"], risk: "medium" as const, recommendation: "Share one analytics data layer.", approvalRoute: "carmen" as const, category: "build-items" as const },
  { title: "Invoice Automation overlap", similarity: 68, overlappingItems: ["Lead routing flow", "Proposal draft trigger"], reason: "Similar Zoho triggers proposed in two automations.", sourceRecords: ["Automation change control"], affectedOwners: ["Sam Rivera", "Tomas Beck"], risk: "medium" as const, recommendation: "Consolidate Zoho trigger logic.", approvalRoute: "carmen" as const, category: "automations" as const },
];

const SEED_ALERTS = [
  { type: "duplicate" as const, message: "High overlap detected between Content Magic and AI Content Generator.", risk: "high" as const, source: "Duplicate Radar", eventDate: "2026-06-16" },
  { type: "missing-owner" as const, message: "Document Collection has no assigned owner for 7 days.", risk: "high" as const, source: "Collab Dashboard", eventDate: "2026-06-15" },
  { type: "blocker" as const, message: "Pricing decision is blocking Business Services Hub.", risk: "high" as const, source: "Decisions", eventDate: "2026-06-15" },
  { type: "stale" as const, message: "Marketing Command Center has been inactive for 17 days.", risk: "medium" as const, source: "Collab Dashboard", eventDate: "2026-06-16" },
  { type: "overlap" as const, message: "Two analytics surfaces planned over the same CRM data.", risk: "medium" as const, source: "Duplicate Radar", eventDate: "2026-06-14" },
  { type: "risk" as const, message: "Compliance workload elevated ahead of deadline.", risk: "medium" as const, source: "Team Pulse", eventDate: "2026-06-14" },
  { type: "stale" as const, message: "Sales Asset Library unowned and stale for 25 days.", risk: "medium" as const, source: "Collab Dashboard", eventDate: "2026-06-13" },
  { type: "duplicate" as const, message: "Invoice automation overlaps existing Zoho triggers.", risk: "medium" as const, source: "Duplicate Radar", eventDate: "2026-06-13" },
];

const SEED_BUILD_BY_PROJECT: Record<string, { name: string; readiness: number; status: "scoping" | "ready" | "in-build" | "blocked" | "shipped"; owner: string | null; source: string }[]> = {
  "Command Center Build": [{ name: "Duplicate Radar engine", readiness: 70, status: "in-build", owner: "Carmen Vega", source: "Replit Builds" }],
  "CRM Architecture": [{ name: "Customer 360 data layer", readiness: 45, status: "scoping", owner: "Priya Nair", source: "Zoho" }],
  QualifierConnect: [{ name: "Qualifier scoring API", readiness: 80, status: "ready", owner: "Tomas Beck", source: "Zoho" }],
  "Document Collection": [{ name: "Document intake bot", readiness: 25, status: "blocked", owner: null, source: "CAG" }],
};

const SEED_TASKS_BY_PROJECT: Record<string, { title: string; owner: string | null; status: "todo" | "in-progress" | "review" | "done"; dueDate: string | null }[]> = {
  "Command Center Build": [{ title: "Wire duplicate detection helper", owner: "Carmen Vega", status: "in-progress", dueDate: "2026-06-20" }],
  "Business Services Hub": [{ title: "Draft client intake SOP", owner: "Dee Okafor", status: "review", dueDate: "2026-06-22" }],
  QualifierConnect: [{ title: "Map qualifier scoring rules", owner: "Tomas Beck", status: "in-progress", dueDate: "2026-06-24" }],
  "Document Collection": [{ title: "Assign document collection owner", owner: null, status: "todo", dueDate: "2026-06-18" }],
  "CRM Architecture": [{ title: "CRM module consolidation review", owner: "Priya Nair", status: "in-progress", dueDate: "2026-06-26" }],
};

export function serializeCompanyRecord(row: CompanyRecordRow) {
  return { id: row.id, title: row.title, type: row.type, summary: row.summary, source: row.source, classification: row.classification, keywords: row.keywords };
}

export function serializeDecision(row: DecisionRow) {
  return { id: row.id, title: row.title, context: row.context, status: row.status, owner: row.owner, approvalRoute: row.approvalRoute, risk: row.risk };
}

export function serializeAutomation(row: AutomationRow) {
  return { id: row.id, name: row.name, system: row.system, status: row.status, owner: row.owner, description: row.description };
}

export function serializeDuplicateRisk(row: DuplicateRiskRow) {
  return {
    id: row.id,
    title: row.title,
    similarity: row.similarity,
    overlappingItems: row.overlappingItems,
    reason: row.reason,
    sourceRecords: row.sourceRecords,
    affectedOwners: row.affectedOwners,
    risk: row.risk,
    recommendation: row.recommendation,
    approvalRoute: row.approvalRoute,
    category: row.category,
  };
}

export function serializeAlert(row: AlertRow) {
  return { id: row.id, type: row.type, message: row.message, risk: row.risk, source: row.source, createdAt: row.createdAt };
}

export function serializeBuildItem(row: BuildItemRow) {
  return { id: row.id, name: row.name, projectId: row.projectId, readiness: row.readiness, status: row.status, owner: row.owner, source: row.source };
}

export function serializeProjectTask(row: ProjectTaskRow) {
  return { id: row.id, title: row.title, projectId: row.projectId, owner: row.owner, status: row.status, due: row.dueDate, source: row.source };
}

export async function seedRegistryIfEmpty(): Promise<void> {
  const existing = await db.select({ id: companyRecordsTable.id }).from(companyRecordsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(companyRecordsTable).values(SEED_COMPANY_RECORDS);
  await db.insert(decisionsTable).values(SEED_DECISIONS);
  await db.insert(automationsTable).values(SEED_AUTOMATIONS);
  await db.insert(duplicateRisksTable).values(SEED_DUPLICATE_RISKS);
  await db.insert(alertsTable).values(
    SEED_ALERTS.map((a) => ({ type: a.type, message: a.message, risk: a.risk, source: a.source, createdAt: a.eventDate })),
  );

  const projectRows = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable);
  const byName = new Map(projectRows.map((p) => [p.name, p.id]));

  const buildRows = Object.entries(SEED_BUILD_BY_PROJECT).flatMap(([name, items]) => {
    const pid = byName.get(name);
    if (!pid) return [];
    return items.map((item) => ({ ...item, projectId: pid }));
  });
  if (buildRows.length > 0) await db.insert(buildItemsTable).values(buildRows);

  const taskRows = Object.entries(SEED_TASKS_BY_PROJECT).flatMap(([name, items]) => {
    const pid = byName.get(name);
    if (!pid) return [];
    return items.map((item) => ({ title: item.title, projectId: pid, owner: item.owner, status: item.status, dueDate: item.dueDate, source: "sync" as const }));
  });
  if (taskRows.length > 0) await db.insert(projectTasksTable).values(taskRows);

  logger.info(
    {
      companyRecords: SEED_COMPANY_RECORDS.length,
      decisions: SEED_DECISIONS.length,
      automations: SEED_AUTOMATIONS.length,
      duplicateRisks: SEED_DUPLICATE_RISKS.length,
      alerts: SEED_ALERTS.length,
      buildItems: buildRows.length,
      tasks: taskRows.length,
    },
    "Seeded registry modules",
  );
}
