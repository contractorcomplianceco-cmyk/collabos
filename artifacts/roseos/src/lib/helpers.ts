import type {
  Role,
  Classification,
  ApprovalRoute,
  RiskLevel,
  CompanyRecord,
  Report,
  Project,
  Blocker,
  Decision,
  IntakeClassification,
  IntakeSensitivity,
  IntakeDuplicateRisk,
} from "@/types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "is",
  "are", "be", "how", "do", "i", "we", "our", "my", "where", "who", "what",
  "should", "next", "can", "this", "that", "it", "at", "by", "from",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Jaccard-style similarity between two text strings, returned as 0-100. */
export function similarityScore(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

export interface DuplicateMatch {
  candidate: { id: string; name: string };
  score: number;
  sharedTerms: string[];
}

/** Detect duplicate/overlapping work against a list of candidates. */
export function detectDuplicates(
  input: string,
  candidates: { id: string; name: string; description?: string }[],
  threshold = 40,
): DuplicateMatch[] {
  const inputTokens = new Set(tokenize(input));
  return candidates
    .map((c) => {
      const text = `${c.name} ${c.description ?? ""}`;
      const score = similarityScore(input, text);
      const candTokens = new Set(tokenize(text));
      const sharedTerms = [...inputTokens].filter((t) => candTokens.has(t));
      return { candidate: { id: c.id, name: c.name }, score, sharedTerms };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

const ROSE_KEYWORDS = ["pricing", "client", "public", "launch", "domain", "brand", "direction", "proposal", "final", "strategy", "positioning"];
const CARMEN_KEYWORDS = ["system", "process", "zoho", "crm", "automation", "data", "build", "architecture", "integration", "readiness", "migration"];

/** Decide which leadership review route a recommendation needs. */
export function routeApproval(
  classification: Classification,
  risk: RiskLevel,
  text: string,
): ApprovalRoute {
  const lower = text.toLowerCase();
  const hitsRose = ROSE_KEYWORDS.some((k) => lower.includes(k));
  const hitsCarmen = CARMEN_KEYWORDS.some((k) => lower.includes(k));

  if (classification === "approved-decision") return "none";
  if (classification === "documented-fact") return "none";

  if (risk === "critical" || risk === "high") {
    if (hitsRose && hitsCarmen) return "both";
    if (classification === "sensitive") return "both";
  }
  if (hitsRose && hitsCarmen) return "both";
  if (hitsRose) return "rose";
  if (hitsCarmen) return "carmen";
  return "rose";
}

/** Who can approve a given route. */
export function canApprove(role: Role, route: ApprovalRoute): boolean {
  if (route === "none") return false;
  if (role === "Admin") return true;
  if (route === "rose") return role === "Rose";
  if (route === "carmen") return role === "Carmen";
  if (route === "both") return role === "Rose" || role === "Carmen";
  return false;
}

/** Permission visibility helper: can a role enter the Mind Meld Room? */
export function canAccessMindMeld(role: Role): boolean {
  return role === "Rose" || role === "Carmen" || role === "Admin";
}

/** Can a role view sensitive / leadership-only content? */
export function canViewSensitive(role: Role): boolean {
  return role === "Rose" || role === "Carmen" || role === "Admin";
}

/** Can a role submit updates/feedback/ideas? */
export function canSubmit(role: Role): boolean {
  return role !== "Viewer";
}

export interface SolutionResult {
  found: boolean;
  answer: string;
  confidence: number;
  sources: CompanyRecord[];
  relatedProjects: string[];
  owner: string | null;
  nextSteps: string[];
  escalation: string;
}

/** Solution finder: search mock Company Brain records for a question. */
export function findSolution(
  query: string,
  records: CompanyRecord[],
  projects: Project[],
): SolutionResult {
  const queryTokens = tokenize(query);
  const scored = records
    .map((r) => {
      const haystack = `${r.title} ${r.summary} ${r.keywords.join(" ")}`;
      const tokens = new Set(tokenize(haystack));
      const matches = queryTokens.filter((t) => tokens.has(t) || r.keywords.includes(t));
      return { record: r, score: matches.length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      found: false,
      answer:
        "I cannot find documentation supporting that conclusion in the uploaded company files.",
      confidence: 0,
      sources: [],
      relatedProjects: [],
      owner: null,
      nextSteps: ["Document this in Company Brain", "Route to the right owner for review"],
      escalation: "Escalate to Carmen for systems questions or Rose for direction.",
    };
  }

  const top = scored.slice(0, 3).map((s) => s.record);
  const confidence = Math.min(95, 45 + scored[0].score * 15);
  const relatedProjects = projects
    .filter((p) =>
      top.some((r) => r.keywords.some((k) => p.name.toLowerCase().includes(k) || p.tags.includes(k))),
    )
    .map((p) => p.name)
    .slice(0, 3);

  return {
    found: true,
    answer: `Based on ${top.length} Company Brain record${top.length > 1 ? "s" : ""}: ${top[0].summary}`,
    confidence,
    sources: top,
    relatedProjects,
    owner: top[0].source === "Company Brain" ? "Carmen Vega" : null,
    nextSteps: [
      "Review the linked Company Brain records",
      "Confirm with the listed owner",
      "Log any new decision for approval",
    ],
    escalation:
      confidence < 70
        ? "Low confidence — escalate to Carmen (systems) or Rose (direction)."
        : "Sufficient documentation found. Proceed with owner confirmation.",
  };
}

/** Mind Meld Carmenfy/Rosify routing helper. */
export function routeMindMeld(
  action: "carmenfy" | "rosify",
): { to: "Rose" | "Carmen"; reason: string } {
  if (action === "carmenfy") {
    return {
      to: "Carmen",
      reason:
        "Routed to Carmen for systems, process, CRM, automation, architecture, or build-readiness review.",
    };
  }
  return {
    to: "Rose",
    reason:
      "Routed to Rose for founder vision, company direction, public positioning, client-facing implications, or final decision review.",
  };
}

export interface GeneratedReport {
  summary: string;
  findings: string[];
  risks: string[];
  recommendations: string[];
  decisionsNeeded: string[];
  nextSteps: string[];
}

/** Report generation helper from live data. */
export function generateReport(
  type: string,
  ctx: { projects: Project[]; blockers: Blocker[]; decisions: Decision[] },
): GeneratedReport {
  const atRisk = ctx.projects.filter((p) => p.risk === "high" || p.status === "at-risk" || p.status === "blocked");
  const unowned = ctx.projects.filter((p) => !p.owner);
  const stale = ctx.projects.filter((p) => p.status === "stale");
  const openDecisions = ctx.decisions.filter((d) => d.status === "open");

  return {
    summary: `${type}: ${ctx.projects.length} projects tracked, ${atRisk.length} need attention, ${openDecisions.length} open decisions.`,
    findings: [
      `${atRisk.length} project(s) flagged at-risk, blocked, or high risk`,
      `${unowned.length} project(s) currently unowned`,
      `${stale.length} project(s) stale and losing momentum`,
      `${ctx.blockers.length} active blocker(s)`,
    ],
    risks: atRisk.map((p) => `${p.name} — ${p.status} (${p.risk} risk)`),
    recommendations: [
      unowned.length ? `Assign owners to ${unowned.map((p) => p.name).join(", ")}` : "All projects have owners",
      openDecisions.length ? `Resolve ${openDecisions.length} open decision(s)` : "No open decisions",
    ],
    decisionsNeeded: openDecisions.map((d) => d.title),
    nextSteps: ["Review with leadership", "Re-baseline timelines", "Update Company Brain"],
  };
}

export function reportFromTemplate(report: Report): GeneratedReport {
  return {
    summary: report.summary,
    findings: report.findings,
    risks: report.risks,
    recommendations: report.recommendations,
    decisionsNeeded: report.decisionsNeeded,
    nextSteps: report.nextSteps,
  };
}

// ---------- External Message Intake ----------

const MIND_MELD_KEYWORDS = ["rose and carmen", "mind meld", "carmenfy", "rosify", "founder review", "strategy"];
const ZOHO_KEYWORDS = ["zoho", "crm", "cliq", "deluge", "workflow"];
const AUTOMATION_KEYWORDS = ["automation", "flow", "form", "field"];
const DECISION_KEYWORDS = ["decision", "approved", "final", "launch", "pricing", "proposal", "client-facing"];
const TODO_KEYWORDS = ["todo", "to-do", "task", "follow up", "follow-up", "remind", "need to do"];
const IDEA_KEYWORDS = ["idea", "what if", "we should", "new product"];
const BUILD_KEYWORDS = ["build request", "can we build", "build a", "build an", "new app", "new module", "feature request"];
const PROCESS_KEYWORDS = ["sop", "process update", "procedure", "how we do", "standard operating"];
const BLOCKER_KEYWORDS = ["blocked", "blocker", "stuck", "can't proceed", "cannot proceed", "waiting on"];
const BRAIN_KEYWORDS = ["company brain", "document this", "for the record", "institutional", "knowledge base"];

const HR_SENSITIVE = ["salary", "compensation", "hiring", "firing", "termination", "performance review", "hr "];
const FINANCIAL_SENSITIVE = ["invoice", "payment", "budget", "revenue", "margin", "financial", "pricing"];
const LEGAL_SENSITIVE = ["contract", "legal", "liability", "nda", "lawsuit", "compliance risk"];
const CLIENT_SENSITIVE = ["client complaint", "client escalation", "client issue", "churn", "refund"];

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function classifyIntakeSensitivity(rawMessage: string): IntakeSensitivity {
  const text = rawMessage.toLowerCase();
  if (hasAny(text, MIND_MELD_KEYWORDS)) return "private_leadership";
  if (hasAny(text, HR_SENSITIVE)) return "hr_sensitive";
  if (hasAny(text, LEGAL_SENSITIVE)) return "legal_sensitive";
  if (hasAny(text, CLIENT_SENSITIVE)) return "client_sensitive";
  if (hasAny(text, FINANCIAL_SENSITIVE)) return "financial_sensitive";
  return "normal";
}

export function classifyIntakeMessage(rawMessage: string): IntakeClassification {
  const text = rawMessage.toLowerCase();
  const sensitivity = classifyIntakeSensitivity(rawMessage);
  const systemsImpact = hasAny(text, ZOHO_KEYWORDS) || hasAny(text, AUTOMATION_KEYWORDS);

  if (hasAny(text, MIND_MELD_KEYWORDS)) {
    return {
      detectedType: "rose_carmen_mind_meld",
      suggestedDestination: "mind-meld",
      sensitivity: "private_leadership",
      reviewOwner: "Rose and Carmen",
      nextStep: "Review privately in the Mind Meld Room before any broader routing.",
    };
  }

  if (hasAny(text, DECISION_KEYWORDS)) {
    return {
      detectedType: "decision_candidate",
      suggestedDestination: "decision-log",
      sensitivity,
      reviewOwner: systemsImpact ? "Rose and Carmen" : "Rose",
      nextStep: systemsImpact
        ? "Decision touches systems - route for joint Rose and Carmen review."
        : "Rose reviews direction, pricing, and client-facing decisions.",
    };
  }

  if (hasAny(text, ZOHO_KEYWORDS) || hasAny(text, AUTOMATION_KEYWORDS)) {
    return {
      detectedType: "crm_or_zoho_request",
      suggestedDestination: hasAny(text, AUTOMATION_KEYWORDS) ? "automation-registry" : "review-queue",
      sensitivity,
      reviewOwner: "Carmen",
      nextStep: "Carmen reviews systems, Zoho, and automation requests.",
    };
  }

  if (hasAny(text, BRAIN_KEYWORDS) || hasAny(text, PROCESS_KEYWORDS)) {
    return {
      detectedType: hasAny(text, BRAIN_KEYWORDS) ? "company_brain_update_suggestion" : "process_update",
      suggestedDestination: "company-brain-update",
      sensitivity,
      reviewOwner: "Rose and Carmen",
      nextStep: "Draft a Company Brain update proposal - never write directly to approved records.",
    };
  }

  if (hasAny(text, BLOCKER_KEYWORDS)) {
    return {
      detectedType: "blocker",
      suggestedDestination: "command-center-task",
      sensitivity,
      reviewOwner: "Assigned team member",
      nextStep: "Create a draft task to unblock, then assign an owner.",
    };
  }

  if (hasAny(text, BUILD_KEYWORDS)) {
    return {
      detectedType: "build_request",
      suggestedDestination: "build-registry",
      sensitivity,
      reviewOwner: "Carmen",
      nextStep: "Carmen reviews build architecture before registry entry.",
    };
  }

  if (hasAny(text, TODO_KEYWORDS)) {
    return {
      detectedType: "todo",
      suggestedDestination: "command-center-task",
      sensitivity,
      reviewOwner: "Assigned team member",
      nextStep: "Create a draft Command Center task for review.",
    };
  }

  if (hasAny(text, IDEA_KEYWORDS)) {
    return {
      detectedType: "idea",
      suggestedDestination: "idea-backlog",
      sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Add to the idea backlog as a draft and check for duplicates.",
    };
  }

  if (text.trim().endsWith("?") || text.includes("question") || text.startsWith("how ") || text.includes("how do")) {
    return {
      detectedType: "question",
      suggestedDestination: "review-queue",
      sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Route to the review queue so the right owner can answer.",
    };
  }

  if (text.trim().split(/\s+/).length <= 3) {
    return {
      detectedType: "ignore_or_noise",
      suggestedDestination: "no-action",
      sensitivity: sensitivity === "normal" ? "normal" : sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Likely noise - archive unless a reviewer disagrees.",
    };
  }

  return {
    detectedType: "question",
    suggestedDestination: "review-queue",
    sensitivity: sensitivity === "normal" ? "unclear" : sensitivity,
    reviewOwner: "Unassigned",
    nextStep: "Unclear intent - needs a human reviewer to classify.",
  };
}

export function summarizeIntakeMessage(rawMessage: string): string {
  const cleaned = rawMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 110) return cleaned;
  return cleaned.slice(0, 107).trimEnd() + "...";
}

export interface IntakeDuplicateResult {
  risk: IntakeDuplicateRisk;
  relatedNames: string[];
}

export function detectIntakeDuplicates(
  rawMessage: string,
  candidates: { name: string; keywords?: string[] }[],
): IntakeDuplicateResult {
  const text = rawMessage.toLowerCase();
  const words = new Set(
    text.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
  const related: { name: string; score: number }[] = [];

  for (const c of candidates) {
    const nameLower = c.name.toLowerCase();
    let score = 0;
    if (text.includes(nameLower)) score += 2;
    const nameWords = nameLower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const nameHits = nameWords.filter((w) => words.has(w)).length;
    if (nameHits > 0) score += nameHits;
    const keywordHits = (c.keywords ?? []).filter((k) => text.includes(k.toLowerCase())).length;
    score += keywordHits;
    if (score > 0) related.push({ name: c.name, score });
  }

  related.sort((a, b) => b.score - a.score);
  const top = related[0];
  const risk: IntakeDuplicateRisk = !top ? "none" : top.score >= 2 ? "likely" : "possible";
  return { risk, relatedNames: related.slice(0, 3).map((r) => r.name) };
}
