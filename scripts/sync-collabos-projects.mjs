#!/usr/bin/env node
/**
 * Nightly CollabOS project registry sync — repos, PM2, HTTP health, Command Center cockpits.
 * Uses DATABASE_URL from collabos.env (loaded by wrapper shell script).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import pg from "/home/ubuntu/projects/collabos/lib/db/node_modules/pg/lib/index.js";

const PROJECTS_ROOT = "/home/ubuntu/projects";
const REGISTRY_PATH =
  "/home/ubuntu/projects/cca-command-center-cloud/artifacts/command-center/public/internal-app-registry.json";
const CC_BASE = "https://command.cagteam.net";
const LOG_PREFIX = () => `[${new Date().toISOString()}]`;

const COCKPIT_SLUGS = [
  "rose",
  "tony",
  "carmen",
  "linda",
  "soraya",
  "alyssa",
  "jestina",
  "tara",
  "chris",
  "christin",
  "nadia",
  "gregg",
  "chloe",
  "emily",
  "landon",
  "opie",
  "skylar",
  "staff-qa",
  "fulfillment-compliance",
];

/** Registry app IDs merged into Command Center — do not sync as standalone PM2/domain projects. */
const REGISTRY_COCKPIT_IDS = new Set([
  "jestinaos",
  "taraos",
  "landon-os",
  "tonyos",
  "alyssa",
  "chloe-marketing-training-hub",
  "gregg-client-cockpit",
  "chrisos",
  "roseos-executive",
  "lindaos",
]);

const CC_COCKPIT_MODULE_STATUSES = new Set(["cockpit_surface", "native_cockpit"]);

const COCKPIT_NAMES = {
  rose: "Rose OS",
  carmen: "Carmen Insight Nexus",
  tony: "Tony OS",
  linda: "Linda OS",
  soraya: "Bloom Soraya Cockpit",
  alyssa: "AlyssaOS",
  jestina: "Jestina Command Center",
  tara: "Tara OS",
  chris: "Chris Command Center",
  christin: "ChristinOS",
  nadia: "NadiaOS",
  gregg: "Gregg Client Cockpit",
  chloe: "Chloe Marketing Training Hub",
  emily: "EmilyoS",
  landon: "Landon OS",
  opie: "Opie Cockpit",
  skylar: "Skylar Cockpit",
  "staff-qa": "Staff QA Workspace",
  "fulfillment-compliance": "Fulfillment Compliance",
};

const EXTRA_ENTITIES = [
  {
    slug: "collabos",
    name: "CollabOS",
    description: "CollabOS Command Center at ccacollab.com — workspace registry and collaboration hub.",
    department: "Systems",
    source: "Server Audit",
    pm2Process: "collabos-api",
    healthUrl: "https://ccacollab.com/api/healthz",
    repoPath: join(PROJECTS_ROOT, "collabos"),
    tags: ["ccacollab.com", "core", "live"],
  },
  {
    slug: "investor-boardroom",
    name: "Investor Boardroom",
    description:
      "CCA Investor Boardroom at investor.ccacontact.com (CCA Growth Capital room). Live; needs Rose confirmation that the experience is ready vs still in progress. Separate from CAG Investor Boardroom.",
    department: "Leadership",
    source: "Nginx Config",
    healthUrl: "https://investor.ccacontact.com",
    tags: ["investor.ccacontact.com", "live", "awaiting-rose", "cca"],
    presetProgress: 75,
    lockProgress: true,
  },
  {
    slug: "cag-investor-boardroom",
    name: "CAG Investor Boardroom",
    description:
      "CAG Investor Boardroom at caginvestor.ccacontact.com — dual CCA+CAG platform boardrooms (Rose 2026-07-09 handoff). Separate from CCA investor.ccacontact.com. Live; confirm final experience with Rose if needed.",
    department: "Leadership",
    source: "Nginx Config",
    healthUrl: "https://caginvestor.ccacontact.com",
    repoPath: join(PROJECTS_ROOT, "cag-cca-investor-boardroom"),
    tags: ["caginvestor.ccacontact.com", "live", "awaiting-rose", "cag"],
    presetProgress: 85,
    lockProgress: true,
  },
  {
    slug: "video-connect",
    name: "VideoConnect",
    description:
      "CCA VideoConnect at ccavideoconnect.com — walkthrough capture API for Bid Intelligence OS bridge. PM2 ccavideoconnect online; health at /health.",
    department: "Sales",
    source: "PM2 + Health Check",
    pm2Process: "ccavideoconnect",
    healthUrl: "https://ccavideoconnect.com/health",
    repoPath: join(PROJECTS_ROOT, "cca-video-connect"),
    tags: ["ccavideoconnect.com", "live", "bidos-bridge"],
    presetProgress: 85,
    lockProgress: true,
  },
  {
    slug: "cca-client-experience",
    name: "CCA Client Experience",
    description:
      "Client experience surface at experience.ccacontact.com — static live site. Confirm with Rose whether this is the finished client-facing experience or still evolving.",
    department: "Client Experience",
    source: "Nginx Config",
    healthUrl: "https://experience.ccacontact.com",
    repoPath: join(PROJECTS_ROOT, "cca-client-experience"),
    tags: ["experience.ccacontact.com", "live", "awaiting-rose"],
    presetProgress: 80,
    lockProgress: true,
  },
  {
    slug: "ec-partnerconnect",
    name: "EC Electric PartnerConnect",
    description:
      "EC Company / EC Electric PartnerConnect Room — private password-gated partner workspace at ec.ccacompliancepartner.com (same PartnerConnect family as FRR). Live on AWS; Zoho Cliq support wiring pending operational approval.",
    department: "Partner Rooms",
    source: "PM2 + Health Check",
    pm2Process: "ec-partnerconnect-api",
    healthUrl: "https://ec.ccacompliancepartner.com/api/healthz",
    repoPath: join(PROJECTS_ROOT, "EC-Company"),
    tags: ["ec.ccacompliancepartner.com", "ec-company", "partnerconnect", "live"],
    presetProgress: 85,
    lockProgress: true,
  },
  {
    slug: "compliance-core",
    name: "ComplianceCore",
    description:
      "CCA ComplianceCore™ — core foundation / single source of truth (cca_client_* in Command Center). Migration and Rose leadership approval not done. Discovery stays on Supabase until Core is approved; do not wire Supabase→intake prefill or treat Core as live master yet.",
    department: "Compliance",
    source: "Architecture",
    healthUrl: "https://command.cagteam.net/os/clients",
    repoPath: join(PROJECTS_ROOT, "cca-command-center-cloud"),
    tags: ["compliancecore", "core", "awaiting-rose", "planning"],
    presetStatus: "planning",
    presetProgress: 35,
  },
  {
    slug: "audit-engine",
    name: "Audit Engine",
    description:
      "CCA Audit Engine™ — protected scoring/intelligence layer. Approved outputs (TrustScore / risk) are not connected to Command Center entitlements yet. Awaiting Rose decision before entitlement wiring.",
    department: "Compliance",
    source: "Architecture",
    healthUrl: "https://command.cagteam.net",
    repoPath: join(PROJECTS_ROOT, "cca-command-center-cloud"),
    tags: ["audit-engine", "awaiting-rose", "planning"],
    presetStatus: "planning",
    presetProgress: 30,
  },
  {
    slug: "audit-risk-model",
    name: "Audit Risk Model",
    description:
      "Risk Audit / Audit Risk Model live at audit.cagteam.net (PM2 cca-audit-api). Hosted and scoring work in progress; leadership sign-off still needed before treating as an approved product path.",
    department: "Compliance",
    source: "PM2 + Health Check",
    pm2Process: "cca-audit-api",
    healthUrl: "https://audit.cagteam.net",
    repoPath: join(PROJECTS_ROOT, "Audit-Risk-Model"),
    tags: ["compliance", "risk-audit", "awaiting-rose", "audit.cagteam.net", "live"],
    presetStatus: "active",
    presetProgress: 70,
    lockProgress: true,
  },
  {
    slug: "cca-discovery-form",
    name: "CCA Discovery Form",
    description:
      "Discovery / intake live at intake.ccacontact.com (PM2 discovery-form-api). discovery.ccacontact.com redirects to the public CCA site. Still awaiting Rose on Core migration / Supabase path and what becomes the long-term live product.",
    department: "Sales",
    source: "PM2 + Health Check",
    pm2Process: "discovery-form-api",
    healthUrl: "https://intake.ccacontact.com/api/healthz",
    repoPath: join(PROJECTS_ROOT, "CCA-Discovery-Form"),
    tags: ["intake.ccacontact.com", "discovery", "live", "awaiting-rose"],
    presetProgress: 80,
    lockProgress: true,
  },
  {
    slug: "exammanageros",
    name: "ExamManagerOS",
    description: "Internal exam-lifecycle operations — Manage. Prepare. Succeed. (RoseOS Ecosystem). Live at exams.cagteam.net.",
    department: "Compliance",
    source: "PM2 + Health Check",
    pm2Process: "exammanageros-api",
    healthUrl: "https://exams.cagteam.net/api/healthz",
    repoPath: join(PROJECTS_ROOT, "exammanageros"),
    tags: ["exams.cagteam.net", "roseos", "live"],
    presetProgress: 90,
    lockProgress: true,
  },
  {
    slug: "cca-portal-api",
    name: "CCA Client Portal API",
    description: "Client portal API backend (internal).",
    department: "Systems",
    source: "PM2",
    pm2Process: "cca-portal-api",
    repoPath: join(PROJECTS_ROOT, "client-portal"),
    tags: ["internal", "api-only"],
  },
  {
    slug: "services-hub-api",
    name: "Services Hub API",
    description: "Business Services Hub API process.",
    department: "Business Services",
    source: "PM2",
    pm2Process: "cca-services-hub-api",
    repoPath: join(PROJECTS_ROOT, "business-services-hub"),
    tags: ["internal", "api"],
  },
  {
    slug: "frr-government-growth-stack",
    name: "FRR Government Growth Stack",
    description: "FRR government growth portal at frr.ccacompliancepartner.com.",
    department: "Compliance",
    source: "PM2 + Health Check",
    pm2Process: "frr-portal-api",
    healthUrl: "https://frr.ccacompliancepartner.com",
    repoPath: join(PROJECTS_ROOT, "frr-government-growth-stack"),
    tags: ["frr.ccacompliancepartner.com", "live"],
  },
  {
    slug: "govconnect-demo",
    name: "GovConnect Demo",
    description:
      "GovConnect demo at demo.ccagovconnect.com — demo only until Rose confirms whether it becomes a real production app.",
    department: "Sales",
    source: "PM2 + Health Check",
    pm2Process: "govconnect-api",
    healthUrl: "https://demo.ccagovconnect.com",
    repoPath: join(PROJECTS_ROOT, "govconect-full-stack"),
    tags: ["demo.ccagovconnect.com", "demo", "awaiting-rose"],
  },
  {
    slug: "bid-intelligence-os",
    name: "Bid Intelligence OS",
    description: "Bid intelligence platform at ccabidintelligence.com.",
    department: "Sales",
    source: "PM2 + Health Check",
    pm2Process: "bid-intelligence-os",
    healthUrl: "https://ccabidintelligence.com",
    repoPath: join(PROJECTS_ROOT, "bid-intelligence-os"),
    tags: ["ccabidintelligence.com", "live"],
  },
  {
    slug: "voice-connect",
    name: "Voice Connect",
    description:
      "VoiceConnect demo at demo.ccavoiceconnect.com — demo only until Rose confirms production path.",
    department: "Sales",
    source: "PM2 + Health Check",
    pm2Process: "ccavoiceconnect",
    healthUrl: "https://demo.ccavoiceconnect.com",
    repoPath: join(PROJECTS_ROOT, "ccavoiceconnect"),
    tags: ["demo.ccavoiceconnect.com", "demo", "awaiting-rose"],
  },
  {
    slug: "facility-intelligence-demo",
    name: "Facility Intelligence Demo",
    description:
      "Facility intelligence demo live at demo.ccafacilityintelligence.com. Demo only until Rose confirms whether it becomes a real production app.",
    department: "Sales",
    source: "Health Check",
    healthUrl: "https://demo.ccafacilityintelligence.com",
    repoPath: join(PROJECTS_ROOT, "facility-demo"),
    tags: ["demo.ccafacilityintelligence.com", "demo", "awaiting-rose"],
    presetStatus: "active",
    presetProgress: 75,
    lockProgress: true,
  },
  {
    slug: "compliance-connect",
    name: "Compliance Connect Demo",
    description:
      "Compliance Connect — production at ccacomplianceconnect.com and demo at demo.ccacomplianceconnect.com (API on PM2 path via nginx). Confirm which host is canonical and whether this becomes the real product.",
    department: "Sales",
    source: "Health Check",
    healthUrl: "https://ccacomplianceconnect.com",
    tags: ["ccacomplianceconnect.com", "demo.ccacomplianceconnect.com", "demo", "awaiting-rose", "live"],
    presetStatus: "active",
    presetProgress: 80,
    lockProgress: true,
  },
  {
    slug: "cag-parent-website",
    name: "CAG Parent Website",
    description:
      "CAG parent site live at complianceauthoritygroup.com. Confirm with Rose that production URL and launch readiness are final (Command Center registry still shows Pending URL).",
    department: "Marketing",
    source: "Health Check",
    healthUrl: "https://complianceauthoritygroup.com",
    repoPath: join(PROJECTS_ROOT, "cag-parent-website"),
    tags: ["complianceauthoritygroup.com", "website", "live", "awaiting-rose"],
    presetStatus: "active",
    presetProgress: 85,
    lockProgress: true,
  },
  {
    slug: "cca-corporate-website",
    name: "CCA Corporate Website",
    description:
      "CCA corporate / contractor site live at contractor-compliance-authority.com. Confirm with Rose that production URL and launch readiness are final.",
    department: "Marketing",
    source: "Health Check",
    healthUrl: "https://contractor-compliance-authority.com",
    repoPath: join(PROJECTS_ROOT, "cca-website"),
    tags: ["contractor-compliance-authority.com", "website", "live", "awaiting-rose"],
    presetStatus: "active",
    presetProgress: 85,
    lockProgress: true,
  },
  {
    slug: "cca-contractor-landing",
    name: "CCA Contractor Landing",
    description:
      "Contractor landing live at ccacontractor.com (and related contractor domains). Confirm with Rose that production URL and launch readiness are final.",
    department: "Marketing",
    source: "Health Check",
    healthUrl: "https://ccacontractor.com",
    repoPath: join(PROJECTS_ROOT, "cca-landing"),
    tags: ["ccacontractor.com", "landing", "live", "awaiting-rose"],
    presetStatus: "active",
    presetProgress: 85,
    lockProgress: true,
  },
];

const REPO_ONLY = [
  { slug: "facility-demo", name: "Facility Demo Walkthrough", repoDir: "facility-demo", department: "Sales", tags: ["demo", "facility"] },
  { slug: "govconnect-archive", name: "GovConnect Source Archive", repoDir: "govconect-source-20260706-1045", department: "Systems", tags: ["archive", "govconnect"], status: "complete", progress: 100 },
  { slug: "profitpulse-archive", name: "ProfitPulse Empty Archive", repoDir: "profitpulse-empty-github-20260629-011142", department: "Finance", tags: ["archive", "empty"], status: "complete", progress: 0 },
];

function log(msg) {
  console.log(`${LOG_PREFIX()} ${msg}`);
}

function normalizeKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function syncTag(slug) {
  return `sync:${slug}`;
}

function httpCode(url) {
  if (!url || url.startsWith("/") || url === "Pending URL") return null;
  const abs = url.startsWith("http") ? url : `${CC_BASE}${url.startsWith("/") ? url : `/${url}`}`;
  try {
    const out = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 10 '${abs.replace(/'/g, "'\\''")}'`, {
      encoding: "utf8",
      timeout: 15000,
    });
    return parseInt(out.trim(), 10);
  } catch {
    return 0;
  }
}

function loadPm2() {
  const map = new Map();
  try {
    const raw = execSync("pm2 jlist 2>/dev/null", { encoding: "utf8", env: { ...process.env, PM2_HOME: process.env.PM2_HOME || "/home/ubuntu/.pm2" } });
    for (const proc of JSON.parse(raw)) {
      map.set(proc.name, {
        status: proc.pm2_env?.status ?? "unknown",
        restarts: proc.pm2_env?.restart_time ?? 0,
      });
    }
  } catch (err) {
    log(`WARN pm2 jlist failed: ${err.message}`);
  }
  return map;
}

function discoverRepos() {
  const repos = [];
  for (const entry of readdirSync(PROJECTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(PROJECTS_ROOT, entry.name);
    if (!existsSync(join(dir, ".git"))) continue;
    repos.push({ slug: entry.name.toLowerCase().replace(/_/g, "-"), dir, name: entry.name });
  }
  return repos;
}

function isMergedCockpitRegistryApp(app) {
  if (REGISTRY_COCKPIT_IDS.has(app.id)) return true;
  if (CC_COCKPIT_MODULE_STATUSES.has(app.commandCenterModuleStatus) && app.commandCenterRoute) {
    return true;
  }
  return false;
}

function loadRegistryEntities() {
  const entities = [];
  try {
    const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
    for (const app of registry.apps ?? []) {
      if (app.doNotShowYet === true && app.systemState === "HIDDEN") continue;
      if (isMergedCockpitRegistryApp(app)) continue;
      const slug = app.id;
      const healthUrl =
        app.liveUrl && !app.liveUrl.startsWith("/") && app.liveUrl !== "Pending URL"
          ? app.liveUrl
          : app.temporaryReviewUrl && app.temporaryReviewUrl.startsWith("http")
            ? app.temporaryReviewUrl
            : null;
      const hasPm2 = Boolean(app.pm2ProcessName);
      const source = hasPm2 && healthUrl ? "PM2 + Health Check" : hasPm2 ? "PM2" : healthUrl ? "Health Check" : "Source Repo";
      entities.push({
        slug,
        name: mapRegistryName(app),
        description:
          slug === "biz-services-hub"
            ? "Business Services Hub at business-services.cagteam.net — live but paused for Rose redesign. Do not treat current UI as final."
            : slug === "profitpulse"
              ? "ProfitPulse demo at demo.ccaprofitpulse.com — demo host only until Rose confirms it becomes a real app."
              : slug === "compliance-connect"
                ? "Compliance Connect — production at ccacomplianceconnect.com and demo at demo.ccacomplianceconnect.com. Confirm demo vs production path with Rose."
                : slug === "voiceconnect-demo"
                  ? "VoiceConnect demo at demo.ccavoiceconnect.com — demo only until Rose confirms production path."
                  : slug === "facility-intelligence-demo"
                    ? "Facility Intelligence demo at demo.ccafacilityintelligence.com — confirm with Rose before treating as production."
                    : slug === "main-website" || slug === "cag-website" || slug === "landing-page"
                      ? `${mapRegistryName(app)} — public site is live; confirm production URL and launch readiness with Rose.`
                      : (app.description || app.appName || slug).slice(0, 500),
        department: (app.department || "Systems").split("/")[0].trim(),
        source,
        pm2Process: app.pm2ProcessName || undefined,
        healthUrl: healthUrl || undefined,
        repoPath: app.cloudFolderPath || undefined,
        tags: [
          ...buildRegistryTags(app),
          ...(slug === "biz-services-hub" ||
          ["profitpulse", "compliance-connect", "voiceconnect-demo", "facility-intelligence-demo", "main-website", "cag-website", "landing-page"].includes(slug)
            ? ["awaiting-rose"]
            : []),
        ],
        presetStatus:
          app.systemState === "DEPRECATED"
            ? "complete"
            : slug === "biz-services-hub"
              ? "at-risk"
              : slug === "compliance-connect"
                ? "active"
                : undefined,
        // Skip stale Pending-URL registry shells when a stronger live EXTRA entity exists
        skipSync:
          slug === "bid-intelligence" ||
          slug === "voiceconnect-demo" ||
          slug === "audit-os" ||
          slug === "main-website" ||
          slug === "cag-website" ||
          slug === "landing-page" ||
          slug === "facility-intelligence-demo" ||
          slug === "compliance-connect",
        presetProgress: slug === "biz-services-hub" ? 60 : undefined,
      });
      if (entities[entities.length - 1].skipSync) entities.pop();
    }
  } catch (err) {
    log(`WARN registry load failed: ${err.message}`);
  }
  return entities;
}

function mapRegistryName(app) {
  const known = {
    "cc-cloud": "Command Center",
    "biz-services-hub": "Business Services Hub",
    "doc-collection": "Document Collection",
    "sales-intelligence": "Sales Intelligence OS",
    jestinaos: "Jestina Command Center",
    taraos: "Tara OS",
    "landon-os": "Landon OS",
    "research-hub": "Research Hub",
    tonyos: "Tony OS",
    "chloe-marketing-training-hub": "Chloe Marketing Training Hub",
    "gregg-client-cockpit": "Gregg Client Cockpit",
    profitpulse: "ProfitPulse Demo",
    "compliance-connect": "Compliance Connect Demo",
    "facility-intelligence-demo": "Facility Intelligence Demo",
    "bid-intelligence": "Bid Intelligence OS",
    "voiceconnect-demo": "Voice Connect",
    "cag-website": "CCA Corporate Website",
    "main-website": "CAG Parent Website",
    "landing-page": "CCA Contractor Landing",
    "frr-government-growth-stack": "FRR Government Growth Stack",
    govconnect: "GovConnect Demo",
  };
  return known[app.id] || app.appName || app.id;
}

function buildRegistryTags(app) {
  const tags = [];
  if (app.commandCenterModuleStatus === "cockpit_surface" || app.commandCenterModuleStatus === "native_module") {
    tags.push("command-center-hosted");
  }
  if (app.liveUrl?.includes("demo.")) tags.push("demo");
  else if (app.systemState === "LIVE" || app.systemState === "PREVIEW") tags.push("live");
  const host = (app.liveUrl || "").match(/https?:\/\/([^/]+)/);
  if (host) tags.push(host[1]);
  return tags;
}

function loadCockpitEntities() {
  const awaitingRoseNotes = {
    soraya:
      "Hosted at https://command.cagteam.net/soraya. Still awaiting Rose — live data wiring and final handoff deferred; Bloom Soraya source exists separately. Do not treat as finished.",
    opie:
      "Hosted at https://command.cagteam.net/opie. CC route is live; needs Rose confirmation that the cockpit is finished vs still read-only/seed panels.",
    skylar:
      "Hosted at https://command.cagteam.net/skylar. CC route is live; needs Rose confirmation that the cockpit is finished vs still read-only/seed panels.",
    "staff-qa":
      "Hosted at https://command.cagteam.net/staff-qa. CC route is live; needs Rose confirmation that QA coverage and cockpit finish criteria are met.",
    "fulfillment-compliance":
      "Hosted at https://command.cagteam.net/fulfillment-compliance. CC route is live; needs Rose confirmation that fulfillment compliance cockpit is finished.",
    alyssa:
      "Hosted at https://command.cagteam.net/alyssa. CC route is live; needs Rose confirmation that AlyssaOS cockpit is finished vs still needs a design pass.",
  };
  return COCKPIT_SLUGS.map((slug) => ({
    slug: `cockpit-${slug}`,
    name: COCKPIT_NAMES[slug] || `${slug} Cockpit`,
    description:
      awaitingRoseNotes[slug] ||
      `Hosted in Command Center at ${CC_BASE}/${slug}. Standalone domain retired; module runs inside Command Center.`,
    department: "Staff OS",
    source: "Command Center",
    healthUrl: `${CC_BASE}/${slug}`,
    repoPath: join(PROJECTS_ROOT, "cca-command-center-cloud"),
    tags: [
      "staff-os",
      "command-center-hosted",
      "command.cagteam.net",
      slug,
      ...(slug === "soraya" || awaitingRoseNotes[slug] ? ["awaiting-rose"] : []),
    ],
    presetStatus: slug === "soraya" ? "at-risk" : undefined,
    presetProgress: slug === "soraya" ? 55 : undefined,
  }));
}

function assessEntity(entity, pm2Map) {
  const blockers = [];
  let httpOk = null;
  let httpStatus = null;

  if (entity.healthUrl) {
    httpStatus = httpCode(entity.healthUrl);
    httpOk = httpStatus >= 200 && httpStatus < 400;
    if (!httpOk) {
      blockers.push({ title: `[sync] HTTP ${httpStatus || "timeout"} for ${entity.healthUrl}`, risk: "high" });
    }
  }

  if (entity.source === "Command Center") {
    if (entity.presetStatus) {
      return {
        status: entity.presetStatus,
        progress: entity.presetProgress ?? (httpOk === false ? 60 : 90),
        risk: entity.presetStatus === "at-risk" || entity.presetStatus === "blocked" ? "high" : httpOk === false ? "medium" : "low",
        blockers,
        httpStatus,
        pm2Restarts: 0,
        pm2Online: null,
        httpOk,
      };
    }
    const status = httpOk === false ? "at-risk" : "active";
    const risk = httpOk === false ? "medium" : "low";
    const progress = httpOk === false ? 60 : 90;
    return { status, progress, risk, blockers, httpStatus, pm2Restarts: 0, pm2Online: null, httpOk };
  }

  let pm2Online = null;
  let pm2Restarts = 0;
  if (entity.pm2Process) {
    const proc = pm2Map.get(entity.pm2Process);
    if (!proc) {
      pm2Online = false;
      blockers.push({ title: `[sync] PM2 process "${entity.pm2Process}" not found`, risk: "critical" });
    } else {
      pm2Online = proc.status === "online";
      pm2Restarts = proc.restarts;
      if (!pm2Online) {
        blockers.push({ title: `[sync] PM2 "${entity.pm2Process}" status=${proc.status}`, risk: "critical" });
      } else if (pm2Restarts > 15) {
        blockers.push({
          title: `[sync] PM2 "${entity.pm2Process}" high restarts (${pm2Restarts})`,
          risk: proc.status === "online" ? "medium" : "high",
        });
      }
    }
  }

  let status = entity.presetStatus || "active";
  let progress = entity.presetProgress ?? 50;
  let risk = "medium";

  if (entity.lockProgress && entity.presetProgress != null) {
    progress = entity.presetProgress;
    status = entity.presetStatus || (pm2Online === false || (entity.healthUrl && httpOk === false) ? "at-risk" : "active");
    if (blockers.some((b) => b.risk === "critical")) risk = "critical";
    else if (blockers.some((b) => b.risk === "high") || status === "at-risk" || status === "blocked") risk = "high";
    else if (status === "planning") risk = "low";
    else if (status === "active" && httpOk !== false) risk = "low";
    return { status, progress, risk, blockers, httpStatus, pm2Restarts, pm2Online, httpOk };
  }

  if (entity.source === "Source Repo" || (!entity.pm2Process && !entity.healthUrl)) {
    status = entity.presetStatus || "planning";
    progress = entity.presetProgress ?? 25;
    risk = "low";
  } else {
    if (httpOk === true) progress += 25;
    if (pm2Online === true) progress += 15;
    if (httpOk === false) progress -= 20;
    if (pm2Online === false) progress -= 25;
    if (pm2Restarts > 10) progress -= 10;
    progress = Math.max(0, Math.min(100, progress));

    if (entity.presetStatus === "complete") {
      status = "complete";
    } else if (entity.presetStatus === "planning" || entity.presetStatus === "at-risk" || entity.presetStatus === "blocked") {
      status = entity.presetStatus;
      if (entity.presetProgress != null) progress = entity.presetProgress;
    } else if (pm2Online === false || (entity.healthUrl && httpOk === false)) {
      status = blockers.some((b) => b.risk === "critical") ? "blocked" : "at-risk";
    } else if (
      (pm2Restarts > 15 && pm2Online !== true) ||
      (httpOk === false && entity.healthUrl)
    ) {
      status = "at-risk";
    } else {
      status = "active";
    }
  }

  if (blockers.some((b) => b.risk === "critical")) risk = "critical";
  else if (blockers.some((b) => b.risk === "high") || status === "at-risk" || status === "blocked") risk = "high";
  else if (status === "planning") risk = "low";
  else if (status === "active" && httpOk === true) risk = "low";

  return { status, progress, risk, blockers, httpStatus, pm2Restarts, pm2Online, httpOk };
}

function mergeTags(existing, incoming, slug, entity) {
  const set = new Set();
  const cockpitSlug = slug.startsWith("cockpit-") ? slug.slice("cockpit-".length) : null;

  for (const t of existing ?? []) {
    if (entity.source === "Command Center" && cockpitSlug) {
      if (t.startsWith("sync:") && t !== syncTag(slug)) continue;
      if (/^[a-z0-9-]+\.cagteam\.net$/.test(t) && t !== "command.cagteam.net") continue;
    }
    set.add(t);
  }
  for (const t of incoming) set.add(t);
  set.add(syncTag(slug));
  return [...set];
}

function entityPriority(entity) {
  if (entity.source === "Command Center") return 100;
  return (entity.pm2Process ? 2 : 0) + (entity.healthUrl ? 2 : 0) + 1;
}

function matchProject(projects, entity) {
  const key = normalizeKey(entity.name);
  const slugTag = syncTag(entity.slug);
  const cockpitSlug = entity.slug.startsWith("cockpit-") ? entity.slug.slice("cockpit-".length) : null;

  for (const p of projects) {
    if (p.tags?.includes(slugTag)) return p;
    if (cockpitSlug && p.tags?.includes(cockpitSlug)) return p;
    if (normalizeKey(p.name) === key) return p;
  }
  return null;
}

function gitLastActivity(repoPath) {
  if (!repoPath || !existsSync(repoPath)) return new Date().toISOString().slice(0, 10);
  try {
    return execSync("git -C " + JSON.stringify(repoPath) + " log -1 --format=%cs 2>/dev/null", { encoding: "utf8" }).trim() || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function inferProjectType(row) {
  const tags = row.tags ?? [];
  if (row.source === "Command Center" || tags.includes("command-center-hosted")) return "merged-cc-host";
  if (tags.includes("demo") || tags.some((t) => String(t).includes("demo."))) return "demo";
  if (row.status === "planning" || tags.includes("source-only") || tags.includes("archive")) return "planning";
  return "live";
}

function deriveBuildPlan(project, blockerCount) {
  const projectType = project.project_type ?? inferProjectType(project);
  const blocked = project.status === "blocked" || blockerCount > 0;
  if (projectType === "demo") {
    return {
      summary: "Demo or preview — not a production app yet",
      currentPhaseId: "demo",
      progress: Math.min(Math.max(project.progress, 40), 100),
      phases: [{ id: "demo", title: "Demo — not in production", status: "active", visibleProgress: 100 }],
      carmenPlanNotes: "",
    };
  }
  if (projectType === "merged-cc-host") {
    return {
      summary: "Runs inside Command Center — standalone domain retired",
      currentPhaseId: "cc-2",
      progress: project.status === "blocked" || project.status === "at-risk" ? 60 : 90,
      phases: [
        { id: "cc-1", title: "Merged into Command Center", status: "complete", visibleProgress: 100 },
        { id: "cc-2", title: "Maintenance mode", status: "active", visibleProgress: 90 },
      ],
      carmenPlanNotes: "Hosted in Command Center. Carmen maintains the module; registry sync tracks health only.",
    };
  }
  const phases = [
    { id: "phase-1", title: "Planning & setup", status: "locked" },
    { id: "phase-2", title: "Build in progress", status: "locked" },
    { id: "phase-3", title: "Live & stable", status: "locked" },
  ];
  let activeIndex = 1;
  if (project.status === "planning") activeIndex = 0;
  else if (project.status === "complete") activeIndex = 2;
  const mapped = phases.map((p, i) => {
    let status = "locked";
    if (i < activeIndex) status = "complete";
    else if (i === activeIndex) status = blocked && i === 1 ? "locked" : "active";
    return { ...p, status };
  });
  const active = mapped.find((p) => p.status === "active") ?? mapped[0];
  return {
    summary: project.status === "complete" ? "Shipped and marked complete" : blocked ? "Blocked — see open blockers below" : project.status === "planning" ? "Still in planning — not in active build yet" : "In progress — actively being built",
    currentPhaseId: active.id,
    progress: Math.min(Math.max(project.progress, 5), project.status === "complete" ? 100 : 95),
    phases: mapped,
    carmenPlanNotes: "",
  };
}

async function ensureBuildPlanSchema(client) {
  await client.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT;
    CREATE TABLE IF NOT EXISTS project_build_plans (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      summary TEXT NOT NULL DEFAULT '',
      current_phase_id TEXT NOT NULL DEFAULT 'phase-1',
      progress INTEGER NOT NULL DEFAULT 0,
      phases JSONB NOT NULL DEFAULT '[]'::jsonb,
      rose_instructions TEXT NOT NULL DEFAULT '',
      carmen_plan_notes TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'sync',
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function syncBuildPlanForProject(client, projectId, blockerCount) {
  const { rows } = await client.query(
    `SELECT p.*, bp.id AS plan_id, bp.source AS plan_source
     FROM projects p
     LEFT JOIN project_build_plans bp ON bp.project_id = p.id
     WHERE p.id = $1`,
    [projectId],
  );
  const project = rows[0];
  if (!project) return;

  const projectType = project.project_type ?? inferProjectType(project);
  if (!project.project_type) {
    await client.query("UPDATE projects SET project_type = $1 WHERE id = $2", [projectType, projectId]);
  }

  if (project.plan_source === "manual") return;

  const derived = deriveBuildPlan({ ...project, project_type: projectType }, blockerCount);
  if (!project.plan_id) {
    await client.query(
      `INSERT INTO project_build_plans
        (project_id, summary, current_phase_id, progress, phases, rose_instructions, carmen_plan_notes, source)
       VALUES ($1, $2, $3, $4, $5::jsonb, '', $6, 'sync')`,
      [projectId, derived.summary, derived.currentPhaseId, derived.progress, JSON.stringify(derived.phases), derived.carmenPlanNotes],
    );
    return;
  }

  await client.query(
    `UPDATE project_build_plans SET
      summary = $1,
      current_phase_id = $2,
      progress = $3,
      phases = $4::jsonb,
      source = 'sync',
      updated_at = NOW()
     WHERE project_id = $5 AND source = 'sync'`,
    [derived.summary, derived.currentPhaseId, derived.progress, JSON.stringify(derived.phases), projectId],
  );
}

async function ensureLastSyncedColumn(client) {
  await client.query(`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ
  `);
}

async function upsertSyncBuildPlan(client, projectId, _entity, _assessment, blockerCount, _now) {
  await syncBuildPlanForProject(client, projectId, blockerCount);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("ERROR DATABASE_URL not set");
    process.exit(1);
  }

  const pm2Map = loadPm2();
  const entities = [
    ...loadRegistryEntities(),
    ...loadCockpitEntities(),
    ...EXTRA_ENTITIES,
    ...REPO_ONLY.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: `Source repo at ${r.repoDir}.`,
      department: r.department,
      source: "Source Repo",
      repoPath: join(PROJECTS_ROOT, r.repoDir),
      tags: r.tags,
      presetStatus: r.status,
      presetProgress: r.progress,
    })),
  ];

  const seenSlugs = new Set();
  const deduped = [];
  for (const e of entities) {
    if (seenSlugs.has(e.slug)) continue;
    seenSlugs.add(e.slug);
    deduped.push(e);
  }

  const repos = discoverRepos();
  for (const repo of repos) {
    const slug = repo.slug;
    if (seenSlugs.has(slug)) continue;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await ensureLastSyncedColumn(client);
  await ensureBuildPlanSchema(client);

  const { rows: projects } = await client.query("SELECT id, name, tags, owner, description, department FROM projects");
  const now = new Date();
  let updated = 0;
  let inserted = 0;
  const summary = [];

  for (const entity of deduped) {
    const assessment = assessEntity(entity, pm2Map);
    const match = matchProject(projects, entity);
    const lastActivity = gitLastActivity(entity.repoPath);
    const tags = mergeTags(match?.tags, entity.tags, entity.slug, entity);

    const signalScore = entityPriority(entity);
    if (match) {
      const existingScore = match._syncScore ?? 0;
      if (existingScore >= signalScore) {
        continue;
      }
      match._syncScore = signalScore;
      await client.query(
        `UPDATE projects SET
          status = $1,
          progress = $2,
          risk = $3,
          source = $4,
          description = $5,
          last_activity = $6,
          tags = $7::jsonb,
          last_synced_at = $8,
          updated_at = $8
        WHERE id = $9`,
        [
          assessment.status,
          assessment.progress,
          assessment.risk,
          entity.source,
          entity.description,
          lastActivity,
          JSON.stringify(tags),
          now,
          match.id,
        ],
      );

      await client.query(
        `DELETE FROM project_blockers WHERE project_id = $1 AND title LIKE '[sync]%'`,
        [match.id],
      );
      for (const b of assessment.blockers) {
        await client.query(
          `INSERT INTO project_blockers (title, project_id, owner, risk, age_days) VALUES ($1, $2, NULL, $3, 0)`,
          [b.title, match.id, b.risk],
        );
      }
      await upsertSyncBuildPlan(client, match.id, entity, assessment, assessment.blockers.length, now);
      updated++;
      summary.push(`update ${entity.name} status=${assessment.status} progress=${assessment.progress}% blockers=${assessment.blockers.length}`);
    } else if (entity.repoPath && existsSync(entity.repoPath)) {
      const { rows } = await client.query(
        `INSERT INTO projects (name, description, department, owner, status, risk, progress, source, classification, last_activity, deadline, tags, last_synced_at)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 'documented-fact', $8, NULL, $9::jsonb, $10)
         RETURNING id`,
        [
          entity.name,
          entity.description,
          entity.department,
          assessment.status,
          assessment.risk,
          assessment.progress,
          entity.source,
          lastActivity,
          JSON.stringify(tags),
          now,
        ],
      );
      const newId = rows[0].id;
      for (const b of assessment.blockers) {
        await client.query(
          `INSERT INTO project_blockers (title, project_id, owner, risk, age_days) VALUES ($1, $2, NULL, $3, 0)`,
          [b.title, newId, b.risk],
        );
      }
      await upsertSyncBuildPlan(client, newId, entity, assessment, assessment.blockers.length, now);
      inserted++;
      projects.push({ id: newId, name: entity.name, tags });
      summary.push(`insert ${entity.name} status=${assessment.status}`);
    }
  }

  await client.end();

  log(`sync complete: ${updated} updated, ${inserted} inserted, ${deduped.length} entities scanned`);
  for (const line of summary.slice(0, 20)) log(`  ${line}`);
  if (summary.length > 20) log(`  ... and ${summary.length - 20} more`);
}

main().catch((err) => {
  log(`ERROR ${err.message}`);
  process.exit(1);
});
