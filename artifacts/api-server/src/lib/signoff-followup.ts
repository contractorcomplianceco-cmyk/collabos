import {
  db,
  decisionsTable,
  projectTasksTable,
  recommendationsTable,
  type Recommendation,
} from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { logger } from "./logger";
import { resolveProjectForRecommendation } from "./match-project";

export type SignoffFollowUp = {
  taskId: number | null;
  taskTitle: string | null;
  taskOwner: string | null;
  projectId: number | null;
  projectName: string | null;
  decisionBumped: boolean;
};

function humanTaskTitle(recommendation: string): string {
  let title = recommendation.trim().replace(/\s+/g, " ");
  title = title.replace(/^(approve|confirm|decide|sign off on|pause)\s+/i, "");
  if (title.length > 140) title = `${title.slice(0, 137).trim()}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function taskOwnerForActor(actorRole: string): string {
  if (actorRole === "carmen_admin") return "Rose Almeida";
  return "Carmen Vega";
}

function overlapScore(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4),
    );
  const A = tokens(a);
  const B = tokens(b);
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return hit;
}

/**
 * After Rose/Carmen signs off: link project, create/update owner task, optionally close related decision.
 */
export async function applySignoffFollowUp(
  row: Recommendation,
  actorRole: string,
): Promise<SignoffFollowUp> {
  const empty: SignoffFollowUp = {
    taskId: null,
    taskTitle: null,
    taskOwner: null,
    projectId: row.projectId ?? null,
    projectName: null,
    decisionBumped: false,
  };

  try {
    const match = await resolveProjectForRecommendation(row.recommendation, row.source, row.projectId);
    const projectId = match?.id ?? null;
    const projectName = match?.name ?? null;
    const title = humanTaskTitle(row.recommendation);
    const owner = taskOwnerForActor(actorRole);

    if (projectId && projectId !== row.projectId) {
      await db
        .update(recommendationsTable)
        .set({ projectId })
        .where(eq(recommendationsTable.id, row.id));
    }

    let taskId: number | null = null;
    if (projectId) {
      const marker = `RQ#${row.id}`;
      const [existing] = await db
        .select()
        .from(projectTasksTable)
        .where(
          and(
            eq(projectTasksTable.projectId, projectId),
            ne(projectTasksTable.status, "done"),
            sql`${projectTasksTable.title} LIKE ${`%${marker}%`}`,
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(projectTasksTable)
          .set({ title: `${title} (${marker})`, owner })
          .where(eq(projectTasksTable.id, existing.id))
          .returning();
        taskId = updated.id;
      } else {
        const [created] = await db
          .insert(projectTasksTable)
          .values({
            title: `${title} (${marker})`,
            projectId,
            owner,
            status: "todo",
            source: "manual",
          })
          .returning();
        taskId = created.id;
      }
    }

    let decisionBumped = false;
    const openDecisions = await db
      .select()
      .from(decisionsTable)
      .where(eq(decisionsTable.status, "open"));
    let best: { id: number; score: number } | null = null;
    for (const d of openDecisions) {
      const score = Math.max(overlapScore(row.recommendation, d.title), overlapScore(row.recommendation, d.context));
      if (score >= 3 && (!best || score > best.score)) best = { id: d.id, score };
    }
    if (best) {
      await db.update(decisionsTable).set({ status: "decided" }).where(eq(decisionsTable.id, best.id));
      decisionBumped = true;
    }

    return {
      taskId,
      taskTitle: title,
      taskOwner: owner,
      projectId,
      projectName,
      decisionBumped,
    };
  } catch (err) {
    logger.error({ err, recommendationId: row.id }, "Sign-off follow-up failed");
    return empty;
  }
}
