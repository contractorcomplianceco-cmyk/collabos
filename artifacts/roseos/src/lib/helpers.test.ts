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
