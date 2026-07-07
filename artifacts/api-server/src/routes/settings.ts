import { Router, type IRouter } from "express";
import { UpdateAppSettingsBody } from "@workspace/api-zod";
import { db, appSettingsTable, integrationStatusTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { hasPermission } from "../lib/permissions";
import { getOrCreateAppSettings, serializeAppSettings } from "../lib/seed-app-settings";
import { serializeIntegrationStatus } from "../lib/seed-integrations";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function canUpdateSettings(role: Parameters<typeof hasPermission>[0]): boolean {
  return (
    hasPermission(role, "system_settings") ||
    hasPermission(role, "integration_settings_manage")
  );
}

router.get("/settings", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view settings" });
    return;
  }
  const row = await getOrCreateAppSettings();
  res.json(serializeAppSettings(row));
});

router.patch("/settings", requireAuth, async (req, res) => {
  const actor = req.user!;
  if (!canUpdateSettings(actor.role)) {
    res.status(403).json({ message: "Your role cannot update settings" });
    return;
  }
  const parsed = UpdateAppSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid settings input" });
    return;
  }
  const existing = await getOrCreateAppSettings();
  const [updated] = await db
    .update(appSettingsTable)
    .set({
      duplicateSensitivity: parsed.data.duplicateSensitivity ?? existing.duplicateSensitivity,
      alertThreshold: parsed.data.alertThreshold ?? existing.alertThreshold,
      reportCadence: parsed.data.reportCadence ?? existing.reportCadence,
      competitors: parsed.data.competitors ?? existing.competitors,
      marketKeywords: parsed.data.marketKeywords ?? existing.marketKeywords,
      mindMeldPrivate: parsed.data.mindMeldPrivate ?? existing.mindMeldPrivate,
      emailAlerts: parsed.data.emailAlerts ?? existing.emailAlerts,
      zohoCliqMode: parsed.data.zohoCliqMode ?? existing.zohoCliqMode,
      whatsappMode: parsed.data.whatsappMode ?? existing.whatsappMode,
      lastTestMessageAt:
        parsed.data.lastTestMessageAt !== undefined
          ? parsed.data.lastTestMessageAt
          : existing.lastTestMessageAt,
    })
    .where(eq(appSettingsTable.id, existing.id))
    .returning();
  const integrationChanged =
    parsed.data.zohoCliqMode !== undefined || parsed.data.whatsappMode !== undefined;
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: integrationChanged ? "integration_setting_changed" : "app_settings_updated",
    targetType: "app_settings",
    targetId: String(existing.id),
    sourceArea: "settings",
    details: integrationChanged ? "Integration mode updated" : "Workspace settings updated",
  });
  res.json(serializeAppSettings(updated));
});

router.get("/integrations/status", requireAuth, async (req, res) => {
  if (!hasPermission(req.user!.role, "view_dashboard")) {
    res.status(403).json({ message: "Your role cannot view integrations" });
    return;
  }
  const rows = await db.select().from(integrationStatusTable).orderBy(asc(integrationStatusTable.name));
  res.json(rows.map(serializeIntegrationStatus));
});

export default router;
