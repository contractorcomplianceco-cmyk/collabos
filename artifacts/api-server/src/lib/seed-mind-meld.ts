import {
  db,
  mindMeldHandoffsTable,
  mindMeldItemsTable,
  mindMeldTimelineTable,
  mindFeedTable,
  type MindMeldHandoffRow,
  type MindMeldItemRow,
  type MindMeldTimelineRow,
  type MindFeedRow,
} from "@workspace/db";
import { logger } from "./logger";

const SEED_ITEMS = [
  {
    title: "Collab OS vNext direction",
    source: "Innovation Lab",
    owner: "Rose" as const,
    status: "ready-to-carmenfy" as const,
    roseThoughts: "Scale the impact without losing the soul. Keep it human, brilliant, and unapologetically different.",
    carmenThoughts: "Operationalize the vision with precision. Build the machine that makes the magic repeatable.",
    synthesis: "Rose OS sees strong synergy: the vision is bold and the systems path is clear. Protect the magic in the details while defining a repeatable playbook.",
    openQuestions: ["What is the smallest lovable v1?", "Which signals do we automate first?", "Where do we draw the privacy line?"],
    alignment: "strong" as const,
    alignmentScore: 86,
    risk: "medium" as const,
    privacy: "leadership-only" as const,
    nextHandoff: "carmen",
    finalOutcome: null,
    layers: ["Vision", "Strategy", "Execution"],
    focusAreas: ["Brand Soul", "Experience", "Community"],
    roseFeedback: ["Love the direction. Protect the magic in the details.", "Consider simplifying the handoff moments."],
    carmenFeedback: ["Let's define the playbook for consistent execution.", "We can automate this handoff workflow."],
    sensitive: true,
    history: [
      { id: "h-1", timestamp: "2026-06-14 09:58", actor: "Rose", action: "Added vision thought" },
      { id: "h-2", timestamp: "2026-06-15 10:24", actor: "Rose OS", action: "Generated private synthesis" },
    ],
  },
  {
    title: "CRM consolidation playbook",
    source: "CRM Architecture",
    owner: "Carmen" as const,
    status: "ready-to-rosify" as const,
    roseThoughts: "Make sure we don't lose the client relationship nuance when we consolidate.",
    carmenThoughts: "Let's define the playbook for consistent execution. We can automate this handoff workflow.",
    synthesis: "Rose OS recommends consolidating modules with a relationship-preserving migration. Needs founder sign-off on client-facing implications.",
    openQuestions: ["Do we migrate in one cut or phased?", "What client comms are needed?"],
    alignment: "partial" as const,
    alignmentScore: 64,
    risk: "medium" as const,
    privacy: "private" as const,
    nextHandoff: "rose",
    finalOutcome: null,
    layers: ["Strategy", "Execution"],
    focusAreas: ["Systems", "Efficiency", "Scale"],
    roseFeedback: ["Keep the client relationship nuance front and center.", "Phase the migration so nothing breaks trust."],
    carmenFeedback: ["Playbook draft is ready for founder review.", "Migration steps are reversible and logged."],
    sensitive: false,
    history: [{ id: "h-3", timestamp: "2026-06-13 14:10", actor: "Carmen", action: "Added systems note" }],
  },
  {
    title: "Public launch positioning",
    source: "Decisions",
    owner: "Rose" as const,
    status: "with-carmen" as const,
    roseThoughts: "I want the launch to feel like a movement, not a product drop.",
    carmenThoughts: "We need the infrastructure to handle the attention before we make noise.",
    synthesis: "Rose OS flags exciting vision with operational readiness gaps. Confirm infrastructure readiness before public positioning.",
    openQuestions: ["Are we infra-ready for launch volume?"],
    alignment: "needs-clarity" as const,
    alignmentScore: 41,
    risk: "high" as const,
    privacy: "leadership-only" as const,
    nextHandoff: "carmen",
    finalOutcome: null,
    layers: ["Vision", "Impact"],
    focusAreas: ["Launch", "Brand Soul"],
    roseFeedback: ["Make the launch feel like a movement.", "Story first, then the feature list."],
    carmenFeedback: ["Confirm infra can handle the attention.", "Stagger the rollout to de-risk volume."],
    sensitive: true,
    history: [{ id: "h-4", timestamp: "2026-06-12 16:30", actor: "Rose", action: "Pressed Ready to Carmenfy" }],
  },
];

const SEED_HANDOFFS = [
  { itemIndex: 1, itemTitle: "CRM consolidation playbook", fromPerson: "Carmen" as const, toPerson: "Rose" as const, layer: "Strategy" as const, eventTimestamp: "10:24 AM", note: "Systems plan ready for founder review." },
  { itemIndex: 0, itemTitle: "Collab OS vNext direction", fromPerson: "Rose" as const, toPerson: "Carmen" as const, layer: "Vision" as const, eventTimestamp: "9:58 AM", note: "Vision framed, ready to operationalize." },
  { itemIndex: 2, itemTitle: "Public launch positioning", fromPerson: "Carmen" as const, toPerson: "Rose" as const, layer: "Execution" as const, eventTimestamp: "Yesterday", note: "Infra readiness questions raised." },
];

const SEED_TIMELINE = [
  { itemTitle: "Collab OS vNext direction", type: "original-message" as const, actor: "Rose" as const, text: "Scale the impact without losing the soul - opened for joint alignment.", eventTimestamp: "2026-06-24 09:10", sensitive: false, needs: "both", readyTo: null, finalized: false },
  { itemTitle: "Collab OS vNext direction", type: "rose-thought" as const, actor: "Rose" as const, text: "Keep it human, brilliant, and unapologetically different.", eventTimestamp: "2026-06-24 09:32", sensitive: false, needs: "carmen", readyTo: null, finalized: false },
  { itemTitle: "Collab OS vNext direction", type: "carmen-thought" as const, actor: "Carmen" as const, text: "Operationalize the vision with precision - build the machine that makes the magic repeatable.", eventTimestamp: "2026-06-24 14:05", sensitive: false, needs: "rose", readyTo: null, finalized: false },
  { itemTitle: "Collab OS vNext direction", type: "synthesis" as const, actor: "Rose OS" as const, text: "Strong synergy: bold vision + clear systems path. Protect the magic in the details while defining a repeatable playbook.", eventTimestamp: "2026-06-25 08:20", sensitive: false, needs: null, readyTo: "carmenfy", finalized: false },
  { itemTitle: "Pricing model for Business Services Hub", type: "decision-candidate" as const, actor: "Rose" as const, text: "Tiered vs usage-based pricing surfaced as a decision candidate - sensitive until the client call.", eventTimestamp: "2026-06-28 10:44", sensitive: true, needs: "both", readyTo: null, finalized: false },
  { itemTitle: "Automation registry ownership", type: "approved-direction" as const, actor: "Carmen" as const, text: "Registry ownership stays with Systems; Sam Rivera maintains entries. Finalized after joint review.", eventTimestamp: "2026-06-26 16:30", sensitive: false, needs: null, readyTo: null, finalized: true },
];

const SEED_MIND_FEED = [
  { actor: "Rose" as const, action: "shared a thought", layer: "Vision" as const, eventTimestamp: "2m ago" },
  { actor: "Carmen" as const, action: "added a perspective", layer: "Strategy" as const, eventTimestamp: "1m ago" },
  { actor: "Rose OS" as const, action: "updated the alignment meter", layer: "Impact" as const, eventTimestamp: "just now" },
];

export function serializeMindMeldItem(row: MindMeldItemRow) {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    owner: row.owner,
    status: row.status,
    roseThoughts: row.roseThoughts,
    carmenThoughts: row.carmenThoughts,
    synthesis: row.synthesis,
    openQuestions: row.openQuestions,
    alignment: row.alignment,
    alignmentScore: row.alignmentScore,
    risk: row.risk,
    privacy: row.privacy,
    nextHandoff: row.nextHandoff,
    finalOutcome: row.finalOutcome,
    layers: row.layers,
    focusAreas: row.focusAreas,
    roseFeedback: row.roseFeedback,
    carmenFeedback: row.carmenFeedback,
    sensitive: row.sensitive,
    history: row.history,
  };
}

export function serializeMindMeldHandoff(row: MindMeldHandoffRow) {
  return {
    id: row.id,
    itemId: row.itemId,
    itemTitle: row.itemTitle,
    from: row.fromPerson,
    to: row.toPerson,
    layer: row.layer,
    timestamp: row.eventTimestamp,
    note: row.note,
  };
}

export function serializeMindMeldTimeline(row: MindMeldTimelineRow) {
  return {
    id: row.id,
    itemTitle: row.itemTitle,
    type: row.type,
    actor: row.actor,
    text: row.text,
    timestamp: row.eventTimestamp,
    sensitive: row.sensitive,
    needs: row.needs,
    readyTo: row.readyTo,
    finalized: row.finalized,
  };
}

export function serializeMindFeedEntry(row: MindFeedRow) {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    layer: row.layer,
    timestamp: row.eventTimestamp,
  };
}

export async function seedMindMeldIfEmpty(): Promise<void> {
  const existing = await db.select({ id: mindMeldItemsTable.id }).from(mindMeldItemsTable).limit(1);
  if (existing.length > 0) return;

  const insertedItems = await db.insert(mindMeldItemsTable).values(SEED_ITEMS).returning({ id: mindMeldItemsTable.id });
  await db.insert(mindMeldHandoffsTable).values(
    SEED_HANDOFFS.map((handoff) => ({
      itemId: insertedItems[handoff.itemIndex]!.id,
      itemTitle: handoff.itemTitle,
      fromPerson: handoff.fromPerson,
      toPerson: handoff.toPerson,
      layer: handoff.layer,
      eventTimestamp: handoff.eventTimestamp,
      note: handoff.note,
    })),
  );
  await db.insert(mindMeldTimelineTable).values(
    SEED_TIMELINE.map((event) => ({
      itemTitle: event.itemTitle,
      type: event.type,
      actor: event.actor,
      text: event.text,
      eventTimestamp: event.eventTimestamp,
      sensitive: event.sensitive,
      needs: event.needs,
      readyTo: event.readyTo,
      finalized: event.finalized,
    })),
  );
  logger.info(
    { items: SEED_ITEMS.length, handoffs: SEED_HANDOFFS.length, timeline: SEED_TIMELINE.length },
    "Seeded Mind Meld shared state",
  );
}

export async function seedMindFeedIfEmpty(): Promise<void> {
  const existing = await db.select({ id: mindFeedTable.id }).from(mindFeedTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(mindFeedTable).values(SEED_MIND_FEED);
  logger.info({ count: SEED_MIND_FEED.length }, "Seeded mind feed entries");
}
