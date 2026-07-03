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
  IntakeItem,
  ReadinessResult,
  ReadinessCategoryScore,
  ReadinessLevel,
  FrictionFlag,
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
      reason: "Mentions founder-alignment language (Rose and Carmen, mind meld, Carmenfy/Rosify, strategy), so it belongs in the private Mind Meld space.",
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
      reason: systemsImpact
        ? "Uses decision language (decision, final, launch, pricing) AND touches systems, so both Rose and Carmen should weigh in."
        : "Uses decision language (decision, final, launch, pricing, proposal) - company direction goes to Rose.",
    };
  }

  if (hasAny(text, ZOHO_KEYWORDS)) {
    return {
      detectedType: "crm_or_zoho_request",
      suggestedDestination: hasAny(text, AUTOMATION_KEYWORDS) ? "automation-registry" : "review-queue",
      sensitivity,
      reviewOwner: "Carmen",
      nextStep: "Carmen reviews systems, Zoho, and automation requests.",
      reason: "Mentions Zoho / CRM / Cliq / workflow language, which is Carmen's systems territory.",
    };
  }

  if (hasAny(text, AUTOMATION_KEYWORDS)) {
    return {
      detectedType: "automation_request",
      suggestedDestination: "automation-registry",
      sensitivity,
      reviewOwner: "Carmen",
      nextStep: "Carmen reviews automation requests before anything is built or changed.",
      reason: "Mentions automation / flow / form / field language, so it is treated as an automation request for Carmen.",
    };
  }

  if (hasAny(text, BRAIN_KEYWORDS) || hasAny(text, PROCESS_KEYWORDS)) {
    return {
      detectedType: hasAny(text, BRAIN_KEYWORDS) ? "company_brain_update_suggestion" : "process_update",
      suggestedDestination: "company-brain-update",
      sensitivity,
      reviewOwner: "Rose and Carmen",
      nextStep: "Draft a Company Brain update proposal - never write directly to approved records.",
      reason: "Suggests company knowledge or process documentation, so it becomes a proposed Company Brain update pending approval.",
    };
  }

  if (hasAny(text, BLOCKER_KEYWORDS)) {
    return {
      detectedType: "blocker",
      suggestedDestination: "command-center-task",
      sensitivity,
      reviewOwner: "Assigned team member",
      nextStep: "Create a draft task to unblock, then assign an owner.",
      reason: "Uses blocked / stuck / waiting-on language, which signals a blocker that needs an owner fast.",
    };
  }

  if (hasAny(text, BUILD_KEYWORDS)) {
    return {
      detectedType: "build_request",
      suggestedDestination: "build-registry",
      sensitivity,
      reviewOwner: "Carmen",
      nextStep: "Carmen reviews build architecture before registry entry.",
      reason: "Asks to build something new (build/app/module/feature language), so it is a build request for Carmen's review.",
    };
  }

  if (hasAny(text, TODO_KEYWORDS)) {
    return {
      detectedType: "todo",
      suggestedDestination: "command-center-task",
      sensitivity,
      reviewOwner: "Assigned team member",
      nextStep: "Create a draft Command Center task for review.",
      reason: "Uses to-do / follow-up / reminder language, which maps to a draft Command Center task.",
    };
  }

  if (hasAny(text, IDEA_KEYWORDS)) {
    return {
      detectedType: "idea",
      suggestedDestination: "idea-backlog",
      sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Add to the idea backlog as a draft and check for duplicates.",
      reason: "Uses idea language (idea, what if, we should, new product), so it is captured as a draft idea.",
    };
  }

  if (sensitivity !== "normal") {
    return {
      detectedType: "sensitive_private_item",
      suggestedDestination: "review-queue",
      sensitivity,
      reviewOwner: "Rose",
      nextStep: "Handle with care - sensitive items are never shared broadly or written to Company Brain automatically.",
      reason: `Contains ${sensitivity.replace(/_/g, " ")} content without a clearer work type, so it is protected and routed for careful review.`,
    };
  }

  if (text.trim().endsWith("?") || text.includes("question") || text.startsWith("how ") || text.includes("how do")) {
    return {
      detectedType: "question",
      suggestedDestination: "review-queue",
      sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Route to the review queue so the right owner can answer.",
      reason: "Reads as a question, so it goes to the review queue for the right owner to answer.",
    };
  }

  if (text.trim().split(/\s+/).length <= 3) {
    return {
      detectedType: "ignore_or_noise",
      suggestedDestination: "no-action",
      sensitivity: sensitivity === "normal" ? "normal" : sensitivity,
      reviewOwner: "Unassigned",
      nextStep: "Likely noise - archive unless a reviewer disagrees.",
      reason: "Very short message with no actionable keywords - likely chatter or noise.",
    };
  }

  return {
    detectedType: "question",
    suggestedDestination: "review-queue",
    sensitivity: sensitivity === "normal" ? "unclear" : sensitivity,
    reviewOwner: "Unassigned",
    nextStep: "Unclear intent - needs a human reviewer to classify.",
    reason: "No clear classification keywords matched - a human reviewer should decide what this is.",
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

// ---------- Decision Readiness Meter ----------

type ReadinessInput = Pick<
  IntakeItem,
  | "rawMessage"
  | "detectedType"
  | "suggestedDestination"
  | "sensitivity"
  | "reviewOwner"
  | "duplicateRisk"
  | "relatedProjectNames"
  | "nextStep"
  | "senderRole"
>;

export function computeIntakeReadiness(item: ReadinessInput): ReadinessResult {
  const words = item.rawMessage.trim().split(/\s+/).length;
  const categories: ReadinessCategoryScore[] = [];

  const visionScore =
    item.detectedType === "ignore_or_noise" ? 10 :
    words >= 25 ? 90 : words >= 12 ? 70 : words >= 6 ? 45 : 25;
  categories.push({
    category: "Vision clarity",
    score: visionScore,
    note: visionScore >= 70 ? "Intent is clearly described." : visionScore >= 45 ? "Some context, but the goal could be sharper." : "Too brief to understand the intent.",
  });

  const systemsTouching = ["crm_or_zoho_request", "automation_request", "build_request"].includes(item.detectedType);
  const systemsScore = systemsTouching ? (item.relatedProjectNames.length > 0 ? 80 : 55) : 75;
  categories.push({
    category: "Systems clarity",
    score: systemsScore,
    note: systemsTouching
      ? item.relatedProjectNames.length > 0
        ? "Touches systems and links to known work."
        : "Touches systems but no known system/project is linked yet."
      : "No direct systems impact detected.",
  });

  const ownerScore = item.reviewOwner === "Unassigned" ? 20 : item.reviewOwner === "Assigned team member" ? 60 : 90;
  categories.push({
    category: "Owner clarity",
    score: ownerScore,
    note: ownerScore >= 90 ? `Clear reviewer: ${item.reviewOwner}.` : ownerScore >= 60 ? "A team member needs to be named." : "No owner suggested yet.",
  });

  const nextStepScore = item.nextStep && !item.nextStep.toLowerCase().includes("unclear") ? 85 : 30;
  categories.push({
    category: "Next-step clarity",
    score: nextStepScore,
    note: nextStepScore >= 85 ? "A concrete next step is suggested." : "No clear next step - needs a human call.",
  });

  const sourceScore = (item.senderRole ? 40 : 20) + (item.relatedProjectNames.length > 0 ? 45 : 20);
  categories.push({
    category: "Source support",
    score: Math.min(sourceScore, 90),
    note: item.relatedProjectNames.length > 0 ? "Related existing work supports this item." : "No supporting documentation or related work linked.",
  });

  const privacyScore = item.sensitivity === "unclear" ? 30 : item.sensitivity === "normal" ? 90 : 70;
  categories.push({
    category: "Privacy readiness",
    score: privacyScore,
    note: item.sensitivity === "unclear" ? "Sensitivity is unclear - review before sharing." : item.sensitivity === "normal" ? "No sensitivity concerns detected." : "Sensitive - routing is restricted and understood.",
  });

  const buildScore =
    item.detectedType === "build_request"
      ? item.duplicateRisk === "none" ? 75 : 45
      : ["idea", "automation_request"].includes(item.detectedType) ? 55 : 35;
  categories.push({
    category: "Build readiness",
    score: buildScore,
    note: item.detectedType === "build_request"
      ? item.duplicateRisk === "none" ? "Build request with no duplicate conflicts." : "Build request overlaps existing work - resolve first."
      : "Not yet framed as a buildable request.",
  });

  const approvalScore = item.reviewOwner === "Unassigned" ? 25 : item.duplicateRisk === "likely" ? 50 : 80;
  categories.push({
    category: "Approval readiness",
    score: approvalScore,
    note: approvalScore >= 80 ? "Clear approval path via the suggested reviewer." : approvalScore >= 50 ? "Approval path exists but duplicates must be resolved." : "No approver identified yet.",
  });

  const overall = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
  const level: ReadinessLevel = overall < 45 ? "not-ready" : overall < 62 ? "needs-details" : overall < 78 ? "review-ready" : "build-ready";
  const missing = categories.filter((c) => c.score < 60).map((c) => c.note);

  const recommendedNextStep =
    level === "not-ready"
      ? "Gather more detail before routing - this is not actionable yet."
      : level === "needs-details"
        ? "Fill the missing pieces below, then route for review."
        : level === "review-ready"
          ? "Route to the suggested reviewer for a decision."
          : "Ready for build review - route it and generate a build prompt.";

  return { level, overall, categories, missing, recommendedNextStep };
}

// ---------- Friction Detector ----------

export function detectIntakeFriction(item: IntakeItem): FrictionFlag[] {
  const flags: FrictionFlag[] = [];
  const text = item.rawMessage.toLowerCase();

  if (item.reviewOwner === "Unassigned") {
    flags.push({
      label: "No owner",
      detail: "Nobody is suggested to review or own this item.",
      suggestedFix: "Assign a reviewer - Carmenfy for systems, Rosify for direction, or name a team member.",
      severity: "high",
    });
  }
  if (!item.nextStep || item.nextStep.toLowerCase().includes("unclear")) {
    flags.push({
      label: "No next step",
      detail: "There is no clear next action for this item.",
      suggestedFix: "Add a reviewer note with the next step, or archive if no action is needed.",
      severity: "high",
    });
  }
  if (!item.senderRole && item.relatedProjectNames.length === 0) {
    flags.push({
      label: "Missing source support",
      detail: "No sender role or related work backs this item up.",
      suggestedFix: "Link related projects or ask the sender for context before acting.",
      severity: "medium",
    });
  }
  if (item.duplicateRisk !== "none") {
    flags.push({
      label: "Possible duplicate",
      detail: `Overlaps with: ${item.relatedProjectNames.join(", ") || "existing work"}.`,
      suggestedFix: "Run Check for Duplicates and link or merge before creating new work.",
      severity: item.duplicateRisk === "likely" ? "high" : "medium",
    });
  }
  if (item.sensitivity !== "normal" && item.sensitivity !== "unclear") {
    flags.push({
      label: "Privacy risk",
      detail: `Contains ${item.sensitivity.replace(/_/g, " ")} content.`,
      suggestedFix: "Keep routing restricted - never share broadly or auto-preserve to Company Brain.",
      severity: "high",
    });
  }
  if (item.sensitivity === "unclear") {
    flags.push({
      label: "Sensitivity unclear",
      detail: "Cannot tell whether this is safe to share broadly.",
      suggestedFix: "A reviewer should set the sensitivity before routing.",
      severity: "medium",
    });
  }
  if (["client-facing", "client call", "proposal", "public"].some((k) => text.includes(k))) {
    flags.push({
      label: "Client-facing risk",
      detail: "Mentions client-facing or public-facing work.",
      suggestedFix: "Rose must approve anything client-facing before it ships.",
      severity: "medium",
    });
  }
  if (["zoho", "crm", "cliq", "deluge"].some((k) => text.includes(k))) {
    flags.push({
      label: "Zoho / CRM impact",
      detail: "Touches CRM or Zoho systems.",
      suggestedFix: "Route through Carmen's systems review before changing anything.",
      severity: "medium",
    });
  }
  if (["automation", "workflow", "flow"].some((k) => text.includes(k))) {
    flags.push({
      label: "Automation risk",
      detail: "Proposes or changes automated behavior.",
      suggestedFix: "Carmen reviews automation changes; document in the Automation Registry.",
      severity: "medium",
    });
  }
  if (item.status === "needs_review" || item.status === "new") {
    if (item.reviewOwner === "Rose" || item.reviewOwner === "Rose and Carmen") {
      flags.push({
        label: "Waiting on Rose",
        detail: "This item needs Rose's review to move forward.",
        suggestedFix: "Surface it in Rose's attention lens or the review queue.",
        severity: "low",
      });
    }
    if (item.reviewOwner === "Carmen" || item.reviewOwner === "Rose and Carmen") {
      flags.push({
        label: "Waiting on Carmen",
        detail: "This item needs Carmen's review to move forward.",
        suggestedFix: "Surface it in Carmen's attention lens or the review queue.",
        severity: "low",
      });
    }
  }
  if (item.rawMessage.trim().split(/\s+/).length < 6 && item.detectedType !== "ignore_or_noise") {
    flags.push({
      label: "Too vague to act on",
      detail: "The message is too short to act on confidently.",
      suggestedFix: "Ask the sender for more detail before routing.",
      severity: "medium",
    });
  }
  return flags;
}

// ---------- Instant Build Prompt Generator ----------

export function generateBuildPrompt(item: IntakeItem): string {
  const sensitive = item.sensitivity !== "normal";
  return [
    "BUILD PROMPT (draft - review before use)",
    "",
    "## App / product context",
    "CollabOS Command Center inside Rose OS - the collaboration intelligence layer for Rose, Carmen, and their team.",
    "",
    "## Goal",
    item.cleanedSummary,
    "",
    "## Source",
    `Captured from ${item.source === "zoho_cliq" ? "Zoho Cliq" : item.source === "whatsapp" ? "WhatsApp" : "manual entry"} (${item.sourceChannel}) by ${item.senderName}${item.senderRole ? ` (${item.senderRole})` : ""} on ${item.receivedAt}.`,
    "",
    "## User roles",
    "- Rose (final approval on direction, pricing, client-facing, launches)",
    "- Carmen (systems, process, Zoho, AI, automation, build architecture review)",
    "- Team members (submit and execute; no approval authority)",
    "",
    "## Required screens",
    "- A queue/list view of the relevant items",
    "- A detail panel with review actions and audit trail",
    "- An approval flow surface (Review Queue integration)",
    "",
    "## Required data model",
    `- Primary entity derived from: "${item.rawMessage.slice(0, 140)}${item.rawMessage.length > 140 ? "..." : ""}"`,
    "- Status lifecycle: draft -> needs review -> approved/rejected",
    "- Audit log on every state change",
    "",
    "## Required actions",
    "- Create as draft (never auto-approved)",
    `- Route to reviewer: ${item.reviewOwner}`,
    "- Approve / reject / request changes with audit trail",
    "",
    "## Review & approval guardrails",
    "- Nothing is auto-approved. All outputs are drafts until Rose, Carmen, or both approve.",
    `- Required approver: ${item.reviewOwner}.`,
    "- Company Brain records require explicit approval before being written.",
    "",
    "## Privacy / sensitivity rules",
    sensitive
      ? `- SENSITIVE (${item.sensitivity.replace(/_/g, " ")}): restrict visibility to leadership; never expose the raw message broadly.`
      : "- Normal sensitivity: standard internal visibility.",
    "",
    "## Integration notes",
    item.relatedProjectNames.length > 0
      ? `- Related existing work: ${item.relatedProjectNames.join(", ")} - link, do not duplicate.`
      : "- No related work detected; run Duplicate Radar before building.",
    "- Frontend-only prototype today: no live Zoho Cliq or WhatsApp integration exists.",
    "",
    "## Acceptance criteria",
    "- The feature works end to end in test mode with seeded data.",
    "- Drafts route through the Review Queue and respect dual-approval rules.",
    "- Sensitive items are visibly protected.",
    "- Audit trail records every routing and review action.",
  ].join("\n");
}
