import { Router, type IRouter } from "express";
import { db, marketCompetitorsTable, marketSignalsTable } from "@workspace/db";
import { asc, desc } from "drizzle-orm";
import { hasPermission } from "../lib/permissions";
import { serializeMarketCompetitor, serializeMarketSignal } from "../lib/seed-market-pulse";
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
  res.json(rows.map(serializeMarketCompetitor));
});

export default router;
