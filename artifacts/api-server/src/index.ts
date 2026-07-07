import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoUsersIfEmpty } from "./lib/seed";
import { seedRecommendationsIfEmpty } from "./lib/seed-recommendations";
import { seedIdeasIfEmpty } from "./lib/seed-ideas";
import { seedMindMeldIfEmpty, seedMindFeedIfEmpty } from "./lib/seed-mind-meld";
import { seedIntakeIfEmpty } from "./lib/seed-intake";
import { seedMemoryCandidatesIfEmpty } from "./lib/seed-memory-candidates";
import { seedFeedbackIfEmpty } from "./lib/seed-feedback";
import { seedTeamPulseExtrasIfEmpty } from "./lib/seed-team-pulse";
import { seedAppSettingsIfEmpty } from "./lib/seed-app-settings";
import { seedProjectsIfEmpty } from "./lib/seed-projects";
import { seedRegistryIfEmpty } from "./lib/seed-registry";
import { seedMarketPulseIfEmpty } from "./lib/seed-market-pulse";
import { seedReportTemplatesIfEmpty } from "./lib/seed-report-templates";
import { seedIntegrationsIfEmpty } from "./lib/seed-integrations";
import { seedAgentWorkIfEmpty } from "./lib/seed-agent-work";
import { ensureStaffAccountsFromEnv } from "./lib/ensure-staff-accounts";

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

seedDemoUsersIfEmpty()
  .then(() => ensureStaffAccountsFromEnv())
  .catch((err) => {
  logger.error({ err }, "Failed to seed demo users or ensure staff accounts");
});

seedRecommendationsIfEmpty().catch((err) => {
  logger.error({ err }, "Failed to seed recommendations");
});

seedIdeasIfEmpty().catch((err) => {
  logger.error({ err }, "Failed to seed ideas");
});

seedMindMeldIfEmpty()
  .then(() => seedMindFeedIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Failed to seed Mind Meld state or feed");
  });

seedIntakeIfEmpty()
  .then(() => seedMemoryCandidatesIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Failed to seed external intake or memory candidates");
  });

seedFeedbackIfEmpty()
  .then(() => seedTeamPulseExtrasIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Failed to seed team feedback or pulse extras");
  });

seedAppSettingsIfEmpty()
  .then(() => seedIntegrationsIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Failed to seed app settings or integrations");
  });

seedProjectsIfEmpty()
  .then(() => seedRegistryIfEmpty())
  .then(() => seedMarketPulseIfEmpty())
  .then(() => seedReportTemplatesIfEmpty())
  .then(() => seedAgentWorkIfEmpty())
  .catch((err) => {
    logger.error({ err }, "Failed to seed projects, registry, market pulse, reports, or agent work");
  });

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
