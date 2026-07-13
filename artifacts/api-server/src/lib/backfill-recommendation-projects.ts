import { db, recommendationsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "./logger";
import { loadProjectsForMatch, matchProjectFromText } from "./match-project";

/** Startup backfill: attach project_id when text clearly names a project. */
export async function backfillRecommendationProjectLinks(): Promise<void> {
  const projects = await loadProjectsForMatch();
  if (projects.length === 0) return;

  const rows = await db
    .select()
    .from(recommendationsTable)
    .where(isNull(recommendationsTable.projectId));

  let linked = 0;
  for (const row of rows) {
    const match = matchProjectFromText(row.recommendation, projects, row.source);
    if (!match) continue;
    const hay = `${row.recommendation} ${row.source}`.toLowerCase();
    const isCollabosFallback = match.name.toLowerCase() === "collabos" && !hay.includes("collabos");
    if (isCollabosFallback) continue;
    await db.update(recommendationsTable).set({ projectId: match.id }).where(eq(recommendationsTable.id, row.id));
    linked += 1;
  }

  if (linked > 0) {
    logger.info({ linked }, "Backfilled recommendation → project links");
  }
}
