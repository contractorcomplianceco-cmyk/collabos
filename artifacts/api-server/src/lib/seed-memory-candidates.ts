import { db, intakeItemsTable, memoryCandidatesTable, type MemoryCandidateRow } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export function serializeMemoryCandidate(row: MemoryCandidateRow) {
  return {
    id: row.id,
    sourceIntakeId: row.sourceIntakeId,
    summary: row.summary,
    destination: row.destination,
    status: row.status,
    sensitive: row.sensitive,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function seedMemoryCandidatesIfEmpty(): Promise<void> {
  const existing = await db.select({ id: memoryCandidatesTable.id }).from(memoryCandidatesTable).limit(1);
  if (existing.length > 0) return;

  const [samIntake] = await db
    .select({ id: intakeItemsTable.id })
    .from(intakeItemsTable)
    .where(eq(intakeItemsTable.senderName, "Sam Rivera"))
    .limit(1);

  await db.insert(memoryCandidatesTable).values([
    {
      sourceIntakeId: samIntake?.id ?? null,
      summary:
        "CAG automations now require a registry entry with owner and rollback plan before deploy - candidate for the SOP Library.",
      destination: "company-brain-suggestion",
      status: "proposed",
      sensitive: false,
      createdBy: "Carmen Vega",
      createdAt: "2026-06-30 15:14",
    },
    {
      sourceIntakeId: null,
      summary:
        "Rose's instinct on tier structure: keep the entry tier lean so upgrade paths stay obvious. Revisit before pricing finalizes.",
      destination: "private-rose-carmen-memory",
      status: "proposed",
      sensitive: true,
      createdBy: "Rose Taylor",
      createdAt: "2026-07-01 09:02",
    },
  ]);
  logger.info({ count: 2 }, "Seeded memory preservation candidates");
}
