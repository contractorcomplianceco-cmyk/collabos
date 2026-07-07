import { db, feedbackItemsTable, type FeedbackItemRow } from "@workspace/db";
import { logger } from "./logger";

const SEED_FEEDBACK = [
  { type: "missing-docs" as const, summary: "No SOP for the new document collection flow.", submittedBy: "Sam Rivera", department: "Systems", privacy: "internal" as const, supportNeed: "Documentation", approvalRoute: "carmen" as const, count: 4 },
  { type: "tool-friction" as const, summary: "Zoho stage changes are confusing for new sales reps.", submittedBy: "Tomas Beck", department: "Sales", privacy: "internal" as const, supportNeed: "Training", approvalRoute: "carmen" as const, count: 6 },
  { type: "workload" as const, summary: "Compliance team stretched ahead of services hub deadline.", submittedBy: "Dee Okafor", department: "Compliance", privacy: "leadership-only" as const, supportNeed: "Leadership support", approvalRoute: "rose" as const, count: 3 },
  { type: "repeated-question" as const, summary: "Where do approved decisions live vs draft ideas?", submittedBy: "Jordan Lee", department: "Marketing", privacy: "internal" as const, supportNeed: "Clarity", approvalRoute: "carmen" as const, count: 5 },
  { type: "training-need" as const, summary: "Team wants a walkthrough of the automation registry.", submittedBy: "Priya Nair", department: "Systems", privacy: "internal" as const, supportNeed: "Training", approvalRoute: "carmen" as const, count: 2 },
];

export function serializeFeedbackItem(row: FeedbackItemRow) {
  return {
    id: row.id,
    type: row.type,
    summary: row.summary,
    submittedBy: row.submittedBy,
    department: row.department,
    privacy: row.privacy,
    supportNeed: row.supportNeed,
    approvalRoute: row.approvalRoute,
    count: row.count,
  };
}

export async function seedFeedbackIfEmpty(): Promise<void> {
  const existing = await db.select({ id: feedbackItemsTable.id }).from(feedbackItemsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(feedbackItemsTable).values(SEED_FEEDBACK);
  logger.info({ count: SEED_FEEDBACK.length }, "Seeded team feedback items");
}
