import { db, blockersTable, projectsTable, type BlockerRow, type ProjectRow } from "@workspace/db";
import { logger } from "./logger";

const SEED_PROJECTS = [
  { name: "Command Center Build", description: "Core Rose OS work and project dashboard module.", department: "Systems", owner: "Carmen Vega", status: "active" as const, risk: "medium" as const, progress: 72, source: "Replit Builds", classification: "documented-fact" as const, lastActivity: "2026-06-15", deadline: "2026-07-01", tags: ["build", "core"] },
  { name: "Business Services Hub", description: "Unified intake and services portal for CCA clients.", department: "Compliance", owner: "Dee Okafor", status: "at-risk" as const, risk: "high" as const, progress: 48, source: "Company Brain", classification: "documented-fact" as const, lastActivity: "2026-06-14", deadline: "2026-06-28", tags: ["services", "client"] },
  { name: "QualifierConnect", description: "Lead qualification and routing automation across CRM.", department: "Sales", owner: "Tomas Beck", status: "active" as const, risk: "low" as const, progress: 64, source: "Zoho", classification: "documented-fact" as const, lastActivity: "2026-06-16", deadline: "2026-07-10", tags: ["crm", "automation"] },
  { name: "Document Collection", description: "Automated compliance document collection workflow.", department: "Compliance", owner: null, status: "blocked" as const, risk: "high" as const, progress: 30, source: "WorkDrive", classification: "documented-fact" as const, lastActivity: "2026-06-09", deadline: "2026-06-25", tags: ["compliance", "automation"] },
  { name: "CRM Architecture", description: "Re-architecture of CRM modules and data model.", department: "Systems", owner: "Priya Nair", status: "active" as const, risk: "medium" as const, progress: 55, source: "Zoho", classification: "documented-fact" as const, lastActivity: "2026-06-15", deadline: "2026-07-20", tags: ["crm", "architecture"] },
  { name: "Marketing Command Center", description: "Campaign planning and content intelligence workspace.", department: "Marketing", owner: "Jordan Lee", status: "stale" as const, risk: "medium" as const, progress: 40, source: "Company Brain", classification: "documented-fact" as const, lastActivity: "2026-05-30", deadline: "2026-07-05", tags: ["marketing", "content"] },
  { name: "Automation Registry", description: "Central registry of all CAG and Zoho automations.", department: "Systems", owner: "Sam Rivera", status: "active" as const, risk: "low" as const, progress: 80, source: "CAG", classification: "documented-fact" as const, lastActivity: "2026-06-16", deadline: null, tags: ["registry", "automation"] },
  { name: "Sales Asset Library", description: "Reusable proposal and pricing asset library.", department: "Sales", owner: null, status: "stale" as const, risk: "medium" as const, progress: 22, source: "Company Brain", classification: "documented-fact" as const, lastActivity: "2026-05-22", deadline: "2026-07-15", tags: ["sales", "assets"] },
];

const SEED_BLOCKERS = [
  { projectIndex: 3, title: "Document Collection has no owner", owner: null, risk: "high" as const, ageDays: 7 },
  { projectIndex: 1, title: "Pricing decision blocking Services Hub", owner: "Rose Almeida", risk: "high" as const, ageDays: 5 },
  { projectIndex: 4, title: "CRM module conflict unresolved", owner: "Priya Nair", risk: "medium" as const, ageDays: 3 },
];

export function serializeProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    department: row.department,
    owner: row.owner,
    status: row.status,
    risk: row.risk,
    progress: row.progress,
    source: row.source,
    classification: row.classification,
    lastActivity: row.lastActivity,
    deadline: row.deadline,
    tags: row.tags,
  };
}

export function serializeBlocker(row: BlockerRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    owner: row.owner,
    risk: row.risk,
    age: row.ageDays,
  };
}

export async function seedProjectsIfEmpty(): Promise<void> {
  const existing = await db.select({ id: projectsTable.id }).from(projectsTable).limit(1);
  if (existing.length > 0) return;

  const inserted = await db.insert(projectsTable).values(SEED_PROJECTS).returning({ id: projectsTable.id });
  await db.insert(blockersTable).values(
    SEED_BLOCKERS.map((b) => ({
      projectId: inserted[b.projectIndex]!.id,
      title: b.title,
      owner: b.owner,
      risk: b.risk,
      ageDays: b.ageDays,
    })),
  );
  logger.info({ projects: SEED_PROJECTS.length, blockers: SEED_BLOCKERS.length }, "Seeded project registry");
}
