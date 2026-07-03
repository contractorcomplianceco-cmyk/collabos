import { describe, it, expect } from "vitest";
import {
  similarityScore,
  detectDuplicates,
  routeApproval,
  canApprove,
  canAccessMindMeld,
  canSubmit,
  findSolution,
  routeMindMeld,
  generateReport,
  classifyIntakeMessage,
  detectIntakeDuplicates,
  summarizeIntakeMessage,
} from "./helpers";
import { companyRecords, projects, blockers, decisions } from "@/data/seed";

describe("similarityScore / detectDuplicates", () => {
  it("returns 100 for identical text", () => {
    expect(similarityScore("AI content generator", "AI content generator")).toBe(100);
  });

  it("returns 0 for fully disjoint text", () => {
    expect(similarityScore("alpha beta", "gamma delta")).toBe(0);
  });

  it("detects overlapping candidates above the threshold", () => {
    const matches = detectDuplicates(
      "AI content generator that drafts content",
      [
        { id: "1", name: "Content Magic", description: "AI drafts content from records" },
        { id: "2", name: "Invoice automation", description: "Zoho billing triggers" },
      ],
      30,
    );
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].candidate.id).toBe("1");
    expect(matches[0].sharedTerms).toContain("content");
  });
});

describe("routeApproval", () => {
  it("routes pricing/client topics to Rose", () => {
    expect(routeApproval("ai-recommendation", "high", "Adjust client pricing model")).toBe("rose");
  });

  it("routes systems/CRM topics to Carmen", () => {
    expect(routeApproval("ai-recommendation", "medium", "Consolidate Zoho CRM automation")).toBe("carmen");
  });

  it("routes mixed high-risk topics to both", () => {
    expect(routeApproval("sensitive", "high", "Client pricing and CRM data migration")).toBe("both");
  });

  it("does not require approval for documented facts", () => {
    expect(routeApproval("documented-fact", "low", "anything")).toBe("none");
  });
});

describe("canApprove (permission visibility)", () => {
  it("lets Rose approve rose-routed items", () => {
    expect(canApprove("Rose", "rose")).toBe(true);
    expect(canApprove("Carmen", "rose")).toBe(false);
  });

  it("requires Rose or Carmen for both-routed items", () => {
    expect(canApprove("Rose", "both")).toBe(true);
    expect(canApprove("Carmen", "both")).toBe(true);
    expect(canApprove("Team Member", "both")).toBe(false);
  });

  it("never allows team members or viewers to approve, but admin can", () => {
    expect(canApprove("Team Member", "carmen")).toBe(false);
    expect(canApprove("Viewer", "rose")).toBe(false);
    expect(canApprove("Admin", "both")).toBe(true);
  });

  it("gates mind meld and submission correctly", () => {
    expect(canAccessMindMeld("Rose")).toBe(true);
    expect(canAccessMindMeld("Viewer")).toBe(false);
    expect(canSubmit("Viewer")).toBe(false);
    expect(canSubmit("Team Member")).toBe(true);
  });
});

describe("findSolution (solution finder matching)", () => {
  it("returns a supported answer with sources for known topics", () => {
    const res = findSolution("how do I handle client onboarding?", companyRecords, projects);
    expect(res.found).toBe(true);
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.confidence).toBeGreaterThan(0);
  });

  it("returns the unsupported message when nothing matches", () => {
    const res = findSolution("quantum teleportation pizza recipe", companyRecords, projects);
    expect(res.found).toBe(false);
    expect(res.answer).toContain("cannot find documentation");
    expect(res.confidence).toBe(0);
  });
});

describe("routeMindMeld (Carmenfy / Rosify)", () => {
  it("carmenfy routes to Carmen", () => {
    expect(routeMindMeld("carmenfy").to).toBe("Carmen");
  });

  it("rosify routes to Rose", () => {
    expect(routeMindMeld("rosify").to).toBe("Rose");
  });
});

describe("generateReport", () => {
  it("summarizes live project data", () => {
    const report = generateReport("Project Health Report", { projects, blockers, decisions });
    expect(report.summary).toContain("projects tracked");
    expect(report.findings.length).toBeGreaterThan(0);
    expect(Array.isArray(report.decisionsNeeded)).toBe(true);
  });
});

describe("classifyIntakeMessage", () => {
  it("routes mind meld language to Rose/Carmen Mind Meld as private leadership", () => {
    const c = classifyIntakeMessage("Rose and Carmen should mind meld on the roadmap");
    expect(c.detectedType).toBe("rose_carmen_mind_meld");
    expect(c.suggestedDestination).toBe("mind-meld");
    expect(c.sensitivity).toBe("private_leadership");
    expect(c.reviewOwner).toBe("Rose and Carmen");
  });

  it("routes Zoho/CRM automation requests to Carmen", () => {
    const c = classifyIntakeMessage("Can we update the Zoho CRM automation flow for lead intake?");
    expect(c.detectedType).toBe("crm_or_zoho_request");
    expect(c.reviewOwner).toBe("Carmen");
    expect(c.suggestedDestination).toBe("automation-registry");
  });

  it("routes decisions to Rose, or both when systems are impacted", () => {
    const roseOnly = classifyIntakeMessage("We need a final decision on the pricing update");
    expect(roseOnly.detectedType).toBe("decision_candidate");
    expect(roseOnly.reviewOwner).toBe("Rose");
    const both = classifyIntakeMessage("Final decision needed on the Zoho workflow rollout");
    expect(both.reviewOwner).toBe("Rose and Carmen");
  });

  it("routes todos to Command Center Task", () => {
    const c = classifyIntakeMessage("Reminder: follow up with the vendor about the onboarding checklist next week");
    expect(c.detectedType).toBe("todo");
    expect(c.suggestedDestination).toBe("command-center-task");
  });

  it("routes ideas to the Idea Backlog", () => {
    const c = classifyIntakeMessage("What if we offered a self-serve onboarding portal as a new product?");
    expect(c.detectedType).toBe("idea");
    expect(c.suggestedDestination).toBe("idea-backlog");
  });

  it("flags HR-sensitive content", () => {
    const c = classifyIntakeMessage("We should discuss the salary adjustment for the ops team idea");
    expect(c.sensitivity).toBe("hr_sensitive");
  });

  it("treats very short messages as noise", () => {
    const c = classifyIntakeMessage("lol ok");
    expect(c.detectedType).toBe("ignore_or_noise");
    expect(c.suggestedDestination).toBe("no-action");
  });

  it("marks unclear longer messages for human review", () => {
    const c = classifyIntakeMessage("The weather in the office lobby was strange this morning honestly");
    expect(c.suggestedDestination).toBe("review-queue");
    expect(c.sensitivity).toBe("unclear");
  });
});

describe("detectIntakeDuplicates", () => {
  const candidates = [
    { name: "QualifierConnect", keywords: ["crm", "automation"] },
    { name: "Document Collection", keywords: ["compliance"] },
  ];

  it("returns likely when a project is named directly", () => {
    const res = detectIntakeDuplicates("The QualifierConnect workflow is missing a field", candidates);
    expect(res.risk).toBe("likely");
    expect(res.relatedNames).toContain("QualifierConnect");
  });

  it("returns possible on a single keyword overlap", () => {
    const res = detectIntakeDuplicates("We have a compliance concern from the audit", candidates);
    expect(res.risk).toBe("possible");
    expect(res.relatedNames).toContain("Document Collection");
  });

  it("returns none when nothing overlaps", () => {
    const res = detectIntakeDuplicates("Lunch order preferences for Friday", candidates);
    expect(res.risk).toBe("none");
    expect(res.relatedNames).toHaveLength(0);
  });
});

describe("summarizeIntakeMessage", () => {
  it("collapses whitespace and truncates long messages", () => {
    const long = "word ".repeat(60);
    const summary = summarizeIntakeMessage(long);
    expect(summary.length).toBeLessThanOrEqual(110);
    expect(summary.endsWith("...")).toBe(true);
    expect(summarizeIntakeMessage("short   message")).toBe("short message");
  });
});
