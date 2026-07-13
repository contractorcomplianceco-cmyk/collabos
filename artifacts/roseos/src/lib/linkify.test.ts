import React from "react";
import { describe, it, expect } from "vitest";
import { linkifyRecommendation } from "./linkify";

function collectTextAndHrefs(node: React.ReactNode): { text: string; hrefs: string[] } {
  const hrefs: string[] = [];
  const walk = (n: React.ReactNode): string => {
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string" || typeof n === "number") return String(n);
    if (Array.isArray(n)) return n.map(walk).join("");
    if (typeof n === "object" && n !== null && "props" in n) {
      const el = n as React.ReactElement<{ href?: string; children?: React.ReactNode }>;
      if (el.props.href) hrefs.push(el.props.href);
      return walk(el.props.children);
    }
    return "";
  };
  return { text: walk(node), hrefs };
}

describe("linkifyRecommendation", () => {
  it("leaves plain text unchanged", () => {
    expect(linkifyRecommendation("Pause further feature work.")).toBe("Pause further feature work.");
  });

  it("linkifies bare domains to https", () => {
    const { text, hrefs } = collectTextAndHrefs(
      linkifyRecommendation("Confirm readiness at investor.ccacontact.com."),
    );
    expect(text).toContain("investor.ccacontact.com");
    expect(hrefs).toEqual(["https://investor.ccacontact.com"]);
  });

  it("preserves explicit https URLs", () => {
    const { hrefs } = collectTextAndHrefs(
      linkifyRecommendation("See https://intake.ccacontact.com/path now"),
    );
    expect(hrefs).toEqual(["https://intake.ccacontact.com/path"]);
  });
});
