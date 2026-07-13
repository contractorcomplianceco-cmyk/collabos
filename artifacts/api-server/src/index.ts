import app from "./app";
import { logger } from "./lib/logger";
import { backfillRecommendationProjectLinks } from "./lib/backfill-recommendation-projects";
import { ensureStaffAccountsFromEnv } from "./lib/ensure-staff-accounts";
import { seedIntegrationsIfEmpty } from "./lib/seed-integrations";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
