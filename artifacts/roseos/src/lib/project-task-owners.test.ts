import { describe, it, expect } from "vitest";
import {
  bucketProjectTaskOwner,
  inferOwnerFromTitle,
  projectTaskCompletedSortKey,
  formatProjectTaskCompletedDate,
} from "./project-task-owners";

describe("bucketProjectTaskOwner", () => {
  it("buckets Rose name variants", () => {
    expect(bucketProjectTaskOwner("Rose")).toBe("rose");
    expect(bucketProjectTaskOwner("Rose Almeida")).toBe("rose");
    expect(bucketProjectTaskOwner(" rose almeida ")).toBe("rose");
  });

  it("buckets Carmen name variants", () => {
    expect(bucketProjectTaskOwner("Carmen")).toBe("carmen");
    expect(bucketProjectTaskOwner("Carmen Vega")).toBe("carmen");
  });

  it("puts team / other owners in team", () => {
    expect(bucketProjectTaskOwner("Jestina")).toBe("team");
    expect(bucketProjectTaskOwner("Rose + Carmen")).toBe("team");
    expect(bucketProjectTaskOwner(null)).toBe("team");
    expect(bucketProjectTaskOwner("")).toBe("team");
  });

  it("infers from title prefix when owner is missing", () => {
    expect(bucketProjectTaskOwner(null, "Rose: Confirm launch")).toBe("rose");
    expect(bucketProjectTaskOwner(null, "Carmen: Wire CRM")).toBe("carmen");
    expect(bucketProjectTaskOwner(null, "Stabilize worker")).toBe("team");
  });
});

describe("inferOwnerFromTitle", () => {
  it("matches Rose:/Carmen: prefixes", () => {
    expect(inferOwnerFromTitle("Rose: Sign off")).toBe("rose");
    expect(inferOwnerFromTitle("Carmen — review")).toBe("carmen");
    expect(inferOwnerFromTitle("Docs Collect: wiring")).toBe(null);
  });
});

describe("completed date helpers", () => {
  it("prefers completedAt for sort and display", () => {
    const task = {
      completedAt: "2026-07-10T12:00:00.000Z",
      createdAt: "2026-01-01T12:00:00.000Z",
    };
    expect(projectTaskCompletedSortKey(task)).toBe(Date.parse(task.completedAt));
    expect(formatProjectTaskCompletedDate(task)).toMatch(/2026/);
  });

  it("falls back to createdAt", () => {
    const task = { completedAt: null, createdAt: "2026-06-01T00:00:00.000Z" };
    expect(projectTaskCompletedSortKey(task)).toBe(Date.parse(task.createdAt!));
    expect(formatProjectTaskCompletedDate(task)).toBeTruthy();
  });
});
