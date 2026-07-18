import app from "./app";
import { logger } from "./lib/logger";
import { backfillRecommendationProjectLinks } from "./lib/backfill-recommendation-projects";
import { refreshMarketSignals } from "./lib/refresh-market-signals";
import { ensureStaffAccountsFromEnv } from "./lib/ensure-staff-accounts";
import { seedIntegrationsIfEmpty } from "./lib/seed-integrations";
import { seedPromptsIfEmpty } from "./lib/seed-prompts";
import { cleanupSeedMindFeedNoise } from "./lib/seed-mind-meld";
import { ensurePendingIntegrationDecisionCards } from "./lib/seed-recommendations";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureStaffAccountsFromEnv().catch((err) => {
  logger.error({ err }, "Failed to ensure staff accounts");
});

seedIntegrationsIfEmpty().catch((err) => {
  logger.error({ err }, "Failed to seed integration status");
});

backfillRecommendationProjectLinks().catch((err) => {
  logger.error({ err }, "Failed to backfill recommendation project links");
});

seedPromptsIfEmpty().catch((err) => {
  logger.error({ err }, "Failed to seed Prompt Library");
});

cleanupSeedMindFeedNoise().catch((err) => {
  logger.error({ err }, "Failed to clean Mind Feed seed noise");
});

ensurePendingIntegrationDecisionCards()
  .then(() => backfillRecommendationProjectLinks())
  .catch((err) => {
    logger.error({ err }, "Failed to ensure Gemini / Zoho Final-decision cards");
  });

// Keep market signals fresh in the background: pull live news on startup and
// every few hours, so Market Pulse stays current even with no active viewer.
const MARKET_REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
function scheduleMarketRefresh() {
  const run = () =>
    refreshMarketSignals().catch((err) => logger.error({ err }, "Scheduled market refresh failed"));
  // Small delay on boot so it doesn't compete with other startup work.
  setTimeout(run, 30_000);
  setInterval(run, MARKET_REFRESH_INTERVAL_MS);
}
scheduleMarketRefresh();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
