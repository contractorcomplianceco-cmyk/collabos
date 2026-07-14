import { db, promptsTable, type Prompt } from "@workspace/db";
import { logger } from "./logger";

export function serializePrompt(row: Prompt) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    intent: row.intent,
    projectId: row.projectId ?? null,
    tags: row.tags ?? [],
    createdBy: row.createdBy,
    createdById: row.createdById ?? null,
    sharedWith: row.sharedWith ?? null,
    sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const STARTER_PROMPTS: Array<{
  title: string;
  body: string;
  intent: "handoff" | "security" | "design" | "audit" | "cursor-brief" | "marketing" | "general";
  tags: string[];
  createdBy: string;
}> = [
  {
    title: "Reply to Rose’s AI",
    intent: "handoff",
    tags: ["rose-ai", "handoff", "carmen-reply"],
    createdBy: "Carmen",
    body: `Carmen → Rose’s AI (paste this reply)

Context from Rose’s handoff:
[paste her AI’s ask / summary]

What Carmen decided / clarified:
1. …
2. …

Constraints (keep):
- Do not invent credentials or live secrets
- Prefer smallest safe change
- Commit only when asked

What Rose’s AI should do next:
[one clear next step]

What to bring back to Carmen:
- Done / blockers
- Files touched
- How to verify`,
  },
  {
    title: "Security review ask",
    intent: "security",
    tags: ["security", "review"],
    createdBy: "Carmen",
    body: `Security review request

Project / surface: [name + URL if any]
Change summary: [what shipped or is proposed]
Threat focus: auth, secrets, data exposure, injection, privilege

Please answer:
1. What's the highest risk in this change?
2. What must be fixed before go-live?
3. What can wait (with monitoring)?
4. Any secrets/credentials accidentally exposed?

Output: short verdict + ordered fixes.`,
  },
  {
    title: "Design / UX review ask",
    intent: "design",
    tags: ["design", "ux"],
    createdBy: "Rose",
    body: `Design / UX review ask

Surface: [page or flow]
Audience: [who uses it]
Goal of this pass: clarity / hierarchy / brand / mobile

Please review for:
1. First-viewport clarity (one job, brand signal if branded)
2. Human copy (is anything jargon-y or robotic?)
3. Hierarchy and next action
4. Mobile: can someone finish the job with a thumb?

Output: 3 must-fix, 3 nice-to-have, one sentence overall take.`,
  },
  {
    title: "Audit / compliance review ask",
    intent: "audit",
    tags: ["audit", "compliance"],
    createdBy: "Carmen",
    body: `Audit / compliance review ask

Project: [name]
Scope: [what to review — copy, flows, data handling, retention]
Standard / expectation: [internal bar or client requirement]

Please check:
1. Are decisions / timestamps attributable?
2. Any PII or sensitive data shown too broadly?
3. Are approvals required before “official” status?
4. Gaps vs our stated process?

Output: pass / pass-with-notes / fail + concrete remediation list.`,
  },
  {
    title: "Cursor build brief stub",
    intent: "cursor-brief",
    tags: ["cursor", "build"],
    createdBy: "Carmen",
    body: `Cursor build brief

Goal: [one sentence]
Repo / path: [path]
Out of scope: [what not to touch]

Do in order:
1. …
2. …
3. …

Acceptance:
- [ ] …
- [ ] …

When done: commit message style, deploy notes if needed, how Carmen verifies as Rose + Carmen.`,
  },
];

/** Seed starter prompts once when the library is empty (non-deleted). */
export async function seedPromptsIfEmpty(): Promise<void> {
  const existing = await db.select({ id: promptsTable.id }).from(promptsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(promptsTable).values(
    STARTER_PROMPTS.map((p) => ({
      title: p.title,
      body: p.body,
      intent: p.intent,
      tags: p.tags,
      createdBy: p.createdBy,
      projectId: null,
      sharedWith: "both",
      sharedAt: new Date(),
    })),
  );
  logger.info({ count: STARTER_PROMPTS.length }, "Seeded Prompt Library starters");
}
