import { db, marketSignalsTable, marketCompetitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateAppSettings } from "./seed-app-settings";
import { fetchArticlesForTerms, classifyArticle } from "./market-news";
import { logger } from "./logger";

export interface RefreshResult {
  fetched: number;
  inserted: number;
  terms: string[];
  refreshedAt: string;
}

/**
 * Pull live news for every watched competitor and keyword, classify each
 * article into a market signal, dedupe against what we've already stored, and
 * recompute per-competitor stats (news volume, trend, threat, sparkline).
 */
export async function refreshMarketSignals(): Promise<RefreshResult> {
  const settings = await getOrCreateAppSettings();
  const competitors = (settings.competitors ?? []).map((c) => c.trim()).filter(Boolean);
  const keywords = (settings.marketKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  const terms = [...new Set([...competitors, ...keywords])];

  const refreshedAt = new Date().toISOString();
  if (terms.length === 0) {
    return { fetched: 0, inserted: 0, terms: [], refreshedAt };
  }

  const articles = await fetchArticlesForTerms(terms);

  let inserted = 0;
  for (const a of articles) {
    const cls = classifyArticle(a.title);
    const dateFound = (a.publishedAt ?? new Date()).toISOString().slice(0, 10);
    // Insert, skipping anything we've already seen (unique external_id).
    const result = await db
      .insert(marketSignalsTable)
      .values({
        source: a.sourceName,
        dateFound,
        signalType: cls.signalType,
        summary: a.title,
        opportunity: cls.opportunity,
        risk: cls.risk,
        recommendedResponse: cls.recommendedResponse,
        reviewOwner: cls.reviewOwner,
        url: a.url,
        matchedTerm: a.matchedTerm,
        externalId: a.externalId,
        publishedAt: a.publishedAt ?? null,
      })
      .onConflictDoNothing({ target: marketSignalsTable.externalId })
      .returning({ id: marketSignalsTable.id });
    if (result.length > 0) inserted += 1;
  }

  await recomputeCompetitorStats(competitors);

  logger.info({ terms: terms.length, fetched: articles.length, inserted }, "Refreshed market signals");
  return { fetched: articles.length, inserted, terms, refreshedAt };
}

/**
 * Recompute each competitor's news volume, movement, trend, threat, and a
 * 7-point weekly sparkline from the signals we've collected for it.
 */
async function recomputeCompetitorStats(competitors: string[]): Promise<void> {
  for (const name of competitors) {
    // Pull this competitor's signals (matched by term) from the last ~7 weeks.
    const rows = await db
      .select({ dateFound: marketSignalsTable.dateFound, risk: marketSignalsTable.risk })
      .from(marketSignalsTable)
      .where(eq(marketSignalsTable.matchedTerm, name));

    const newsCount = rows.length;

    // Weekly buckets for a 7-point sparkline (oldest -> newest).
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const series = new Array(7).fill(0);
    for (const r of rows) {
      const t = new Date(r.dateFound).getTime();
      if (Number.isNaN(t)) continue;
      const weeksAgo = Math.floor((now - t) / week);
      if (weeksAgo >= 0 && weeksAgo < 7) series[6 - weeksAgo] += 1;
    }

    const movement = series[6] - series[5];
    const trend = movement > 0 ? "up" : movement < 0 ? "down" : "flat";
    // Threat scales with recent volume and any high/critical-risk coverage.
    const hasHighRisk = rows.some((r) => r.risk === "high" || r.risk === "critical");
    const recent = series[6] + series[5];
    const threat =
      recent >= 5 || hasHighRisk ? "high" : recent >= 2 ? "medium" : newsCount > 0 ? "low" : "watch";

    // Upsert the competitor row (create if it only existed in settings).
    const existing = await db
      .select({ id: marketCompetitorsTable.id })
      .from(marketCompetitorsTable)
      .where(eq(marketCompetitorsTable.name, name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(marketCompetitorsTable)
        .set({ newsCount, movement, trend, threat, series })
        .where(eq(marketCompetitorsTable.id, existing[0].id));
    } else {
      await db
        .insert(marketCompetitorsTable)
        .values({ name, newsCount, movement, trend, threat, series });
    }
  }

}
