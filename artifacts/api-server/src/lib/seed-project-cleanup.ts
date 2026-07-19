import { db, projectsTable } from "@workspace/db";
import { readFileSync } from "node:fs";
import { logger } from "./logger";

/**
 * Project Cleanup population.
 *
 * Merges the live GitHub repo list (contractorcomplianceco-cmyk) with the names
 * from the user's cleanup memo, deduped. Every row is inserted with the six
 * governance label columns BLANK for review, per the workflow. We only pre-fill:
 *   - cleanupWave: a *suggested* wave (1/2/3) from name heuristics, so the wave
 *     task lists can be generated. The user confirms/corrects via the labels.
 *   - repoExists: "live" if it maps to a real repo, "memo-only" if it came from
 *     the memo with no matching repo (flagged for the user).
 *   - doNotClaim: guardrail note for twins/mirrors/archives/clean-stale copies.
 *
 * Idempotent: skips names already present in the projects table.
 */

// Memo names from the user's cleanup brief (canonical labels).
const MEMO_NAMES = [
  "Public sites",
  "Command Center",
  "Staff cockpits / person-OS portals",
  "Docs Collect / Document-Collection",
  "DataVaultOS",
  "compliance-core",
  "trustscore",
  "AuditOS / exammanageros",
  "Client portals",
  "Partner/investor rooms",
  "serviceOS / serviceconnect",
  "Research hub",
  "SalesIntelligenceOS",
  "marketingOS",
  "bid-intelligence-os",
  "speak-capture-bid",
  "profitpulse",
  "ledgeros / ledger-chum",
  "Facility demos",
  "franchiseos",
  "Gov-Connect",
  "FRR stacks",
  "healthcast",
  "Affiliate / client portals",
  "Proposals",
  "Future sites",
  "Video / voice connect",
  "Training cockpits",
  "SecurityIntelligenceOS / Billy",
  "Zoho tools",
  "Archives / twins",
];

type Wave = 1 | 2 | 3;

// --- Heuristics --------------------------------------------------------------

// Wave 3: bridges, twins, archives, clean/stale copies, Zoho hybrid.
const WAVE3 = /bridge|twin|-clean|clean-handoff|shallow|stale|empty-github|deploy-backup|archive|-1$|assembly-delivered|assemblydelivered|zoho|handoff/i;

// Wave 2: internal OS, staff cockpits, person-OS portals, internal cores.
const WAVE2 = /command-center|command$|-os$|os-|cockpit|compliance-core|auditengine|audit-risk|exammanage|salesintelligence|marketingos|ledger|datavault|securityintelligence|research-hub|onboarding-router|platform$|business-services|carmenos|roseos|alyssaos|emilyos|christinos|greggos|lindaos|landonos|nadiaos|taraos|tonyos|jestinaos|christin|soraya|bloom-soraya|carmen-insight|chris-s-command|linda-os|executive-command|assembly-command|plumbing-ops-command|jestinaos-command/i;

// Wave 1: client/partner/investor surfaces, products & demos.
const WAVE1 = /portal|client|partner|investor|ccainvestor|ccapartner|cag-|landing|website|^cca$|serviceconnect|serviceos|facility|bidintelligence|speak-capture|trustscore|franchiseos|gov-?conn|govconect|healthcast|profitpulse|draftiq|draft-iq|proposal|roofing|steel-link|plumbing|scottyshope|assemblydelivered|assembly-delivered|ec-company|markkenny|obrien|teamtara|taras-glamorous|cream-luxe/i;

// Do-not-treat-as-SoT guardrail patterns.
const NOT_SOT = /twin|mirror|-clean|clean-handoff|shallow|stale|empty-github|deploy-backup|archive|bridge/i;

function suggestWave(name: string): Wave {
  const n = name.toLowerCase();
  if (WAVE3.test(n)) return 3;
  if (WAVE1.test(n)) return 1;
  if (WAVE2.test(n)) return 2;
  return 2; // default unknown internal-ish to Wave 2 for review
}

function doNotClaimNote(name: string, isArchived: boolean): string | null {
  const notes: string[] = [];
  if (NOT_SOT.test(name)) notes.push("Not a Source-of-Truth unless explicitly marked (twin/mirror/clean/stale/bridge/archive).");
  if (isArchived) notes.push("GitHub-archived.");
  if (/audit|exammanage|trustscore|compliance-core|securityintelligence|risk-model/i.test(name)) {
    notes.push("Trade-secret / internal-only: no demo/product conversion or public score without explicit approval.");
  }
  return notes.length ? notes.join(" ") : null;
}

interface Repo { name: string; description: string; isArchived: boolean; pushedAt?: string }

export async function seedProjectCleanup(reposPath = "/home/user/workspace/repos.json"): Promise<{ inserted: number; skipped: number; total: number }> {
  let repos: Repo[] = [];
  try {
    repos = JSON.parse(readFileSync(reposPath, "utf8"));
  } catch {
    logger.warn("repos.json not found; seeding memo names only");
  }

  const existing = await db.select({ name: projectsTable.name }).from(projectsTable);
  const existingLower = new Set(existing.map((r) => r.name.toLowerCase()));

  const rows: (typeof projectsTable.$inferInsert)[] = [];
  const seen = new Set<string>();

  // 1) Live repos
  for (const r of repos) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (existingLower.has(key)) continue;
    rows.push({
      name: r.name,
      description: r.description || "(no description)",
      department: "Cleanup",
      owner: null,
      status: "active",
      risk: "medium",
      progress: 0,
      source: "GitHub import",
      classification: "documented-fact",
      lastActivity: r.pushedAt ? r.pushedAt.slice(0, 10) : "unknown",
      tags: ["cleanup"],
      cleanupWave: suggestWave(r.name),
      repoExists: "live",
      doNotClaim: doNotClaimNote(r.name, r.isArchived),
    });
  }

  // 2) Memo-only names (no matching repo)
  const repoNames = new Set(repos.map((r) => r.name.toLowerCase()));
  for (const memo of MEMO_NAMES) {
    const key = memo.toLowerCase();
    // Skip memo entries that clearly map to an existing repo token.
    const firstToken = key.split(/[\s/]/)[0];
    if (seen.has(key) || existingLower.has(key)) continue;
    const mappedToRepo = [...repoNames].some((rn) => rn.includes(firstToken) && firstToken.length > 3);
    seen.add(key);
    rows.push({
      name: memo,
      description: "Memo category from cleanup brief.",
      department: "Cleanup",
      owner: null,
      status: "planning",
      risk: "medium",
      progress: 0,
      source: "Cleanup memo",
      classification: "user-update",
      lastActivity: "unknown",
      tags: ["cleanup", "memo"],
      cleanupWave: suggestWave(memo),
      repoExists: mappedToRepo ? "memo (maps to repos)" : "memo-only (no repo)",
      doNotClaim: doNotClaimNote(memo, false),
    });
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped: existing.length, total: existing.length };
  }

  await db.insert(projectsTable).values(rows);
  logger.info({ inserted: rows.length }, "Seeded Project Cleanup rows");
  return { inserted: rows.length, skipped: existing.length, total: existing.length + rows.length };
}
