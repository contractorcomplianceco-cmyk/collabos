import { Router, type IRouter } from "express";
import { db, marketCompetitorsTable, marketSignalsTable } from "@workspace/db";
import { asc, desc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { serializeMarketCompetitor, serializeMarketSignal } from "../lib/seed-market-pulse";
import { getOrCreateAppSettings } from "../lib/seed-app-settings";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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

  // Competitors added in Settings are the source of truth for "who to watch."
  // Surface any that don't yet have a market-data row as an empty watch card,
  // so adding a competitor in Settings immediately shows up here (instead of
  // the two lists silently diverging).
  const settings = await getOrCreateAppSettings();
  const existingNames = new Set(tracked.map((c) => c.name.toLowerCase()));
  const placeholders = (settings.competitors ?? [])
    .filter((name) => name.trim() && !existingNames.has(name.trim().toLowerCase()))
    .map((name, i) => ({
      id: -(i + 1), // negative synthetic ids so they never collide with real rows
      name: name.trim(),
      threat: "watch" as const,
      trend: "flat" as const,
      newsCount: 0,
      movement: 0,
      series: [] as number[],
    }));

  res.json([...tracked, ...placeholders].sort((a, b) => a.name.localeCompare(b.name)));
});

export default router;
