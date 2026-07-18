import { Router, type IRouter } from "express";
import { db, marketCompetitorsTable, marketSignalsTable } from "@workspace/db";
import { asc, desc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { serializeMarketCompetitor, serializeMarketSignal } from "../lib/seed-market-pulse";
import { getOrCreateAppSettings } from "../lib/seed-app-settings";
import { refreshMarketSignals } from "../lib/refresh-market-signals";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// A refresh in progress, shared so concurrent clicks reuse the same fetch.
let inFlight: ReturnType<typeof refreshMarketSignals> | null = null;
let lastRefreshedAt: string | null = null;

function requireDashboard(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]) {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view market pulse data" });
    return;
  }
  next();
}

router.get("/market/signals", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(marketSignalsTable).orderBy(desc(marketSignalsTable.dateFound));
  res.json(rows.map(serializeMarketSignal));
});

router.get("/market/competitors", requireAuth, requireDashboard, async (_req, res) => {
  const rows = await db.select().from(marketCompetitorsTable).orderBy(asc(marketCompetitorsTable.name));
  const tracked = rows.map(serializeMarketCompetitor);

  // Competitors added in Settings are the source of truth for who to watch.
  // Surface any that don't yet have a market-data row as an empty watch card.
  const settings = await getOrCreateAppSettings();
  const existing = new Set(tracked.map((c) => c.name.toLowerCase()));
  const placeholders = (settings.competitors ?? [])
    .filter((name) => name.trim() && !existing.has(name.trim().toLowerCase()))
    .map((name, i) => ({
      id: -(i + 1),
      name: name.trim(),
      threat: "watch" as const,
      trend: "flat" as const,
      newsCount: 0,
      movement: 0,
      series: [] as number[],
    }));

  res.json([...tracked, ...placeholders].sort((a, b) => a.name.localeCompare(b.name)));
});

// Pull live news for watched competitors/keywords and ingest new signals.
// Requires a role that can act on the workspace (excludes viewers/guests).
router.post("/market/refresh", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "build_prompt_generate")) {
    res.status(403).json({ message: "Your role cannot refresh market signals" });
    return;
  }
  try {
    // Coalesce concurrent refreshes into one upstream fetch.
    if (!inFlight) {
      inFlight = refreshMarketSignals().finally(() => { inFlight = null; });
    }
    const result = await inFlight;
    lastRefreshedAt = result.refreshedAt;
    res.json(result);
  } catch {
    res.status(502).json({ message: "Could not fetch news right now. Please try again." });
  }
});

// Lightweight status for the UI (last refresh time).
router.get("/market/status", requireAuth, requireDashboard, (_req, res) => {
  res.json({ lastRefreshedAt });
});

export default router;
