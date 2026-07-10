# CollabOS Operations Runbook

## Current Status

CollabOS Command Center is live on this server at:

- Primary URL: https://ccacollab.com
- WWW URL: https://www.ccacollab.com
- Health endpoint: https://ccacollab.com/api/healthz

This deployment is based on Rose's approved source commit:

- Repository: https://github.com/contractorcomplianceco-cmyk/collabos
- Commit: `6350bc6284a87d18b59eecae1e32d8c3fc330610`
- Local project path: `/home/ubuntu/projects/collabos`

## Architecture

- Frontend: React/Vite static build served by nginx.
- API: Express server managed by PM2.
- Database: local PostgreSQL database for CollabOS staging/live operation.
- Auth: app-owned users and database-backed sessions via httpOnly cookie (`collabos_session`). Bearer header still accepted for one-deploy backward compatibility and Command Center service token.
- Shared module state: PostgreSQL + Express API backed for the main CollabOS workspace modules. Browser `localStorage` is limited to the demo role preference only (auth token removed).

## Runtime Inventory

- PM2 process: `collabos-api`
- API local port: `5015`
- Static web root: `/var/www/ccacollab.com`
- Nginx vhost: `/etc/nginx/sites-available/ccacollab.com`
- Enabled nginx link: `/etc/nginx/sites-enabled/ccacollab.com`
- Server env file: `/home/ubuntu/projects/scripts/collabos.env`
- Uptime monitor: `/home/ubuntu/projects/scripts/check-collabos-uptime.sh`
- Monitor log: `/home/ubuntu/logs/collabos-uptime.log`
- Latest monitor status: `/home/ubuntu/logs/collabos-uptime-latest.txt`

Do not print or commit env file values.

## Common Commands

Check app status:

```bash
pm2 describe collabos-api
curl -sf https://ccacollab.com/api/healthz
curl -sf -o /dev/null -w '%{http_code}\n' https://ccacollab.com/
```

Restart API:

```bash
pm2 restart collabos-api
pm2 save
```

Reload nginx after config changes:

```bash
sudo cp deploy/nginx/ccacollab.com.conf /etc/nginx/sites-available/ccacollab.com
sudo nginx -t
sudo systemctl reload nginx
```

## SPA Cache Busting (no hard refresh)

CollabOS is a Vite SPA. Users must see new deploys on a normal browser refresh (F5), not Ctrl+Shift+R.

**Root cause if stale UI appears:** the browser cached `index.html`, which still points at old `/assets/*` hashes. Hashed JS/CSS are intentionally cached for one year; only the HTML shell must stay uncached.

**Nginx policy** (`deploy/nginx/ccacollab.com.conf`):

- `/` and `/index.html`: `Cache-Control: no-store, no-cache, must-revalidate` (plus `Pragma: no-cache`)
- `/assets/*` and other hashed static files: `Cache-Control: public, max-age=31536000, immutable`
- No service worker — do not add one without a cache-busting update strategy

**Verify headers after deploy:**

```bash
curl -sI https://ccacollab.com/ | grep -i cache-control
curl -sI https://ccacollab.com/index.html | grep -i cache-control
JS=$(curl -s https://ccacollab.com/ | grep -oE '/assets/[^"]+\.js' | head -1)
curl -sI "https://ccacollab.com${JS}" | grep -i cache-control
```

Expected: `no-store` on `/` and `/index.html`; `immutable` on `/assets/*.js`.

Run monitor manually:

```bash
/home/ubuntu/projects/scripts/check-collabos-uptime.sh --dry-run
```

## Deploy Update

From `/home/ubuntu/projects/collabos`:

```bash
git pull --ff-only
set -a
. /home/ubuntu/projects/scripts/collabos.env
set +a
pnpm install
pnpm run typecheck
pnpm --filter @workspace/roseos run test
pnpm run build
sudo rsync -a --delete artifacts/roseos/dist/public/ /var/www/ccacollab.com/
pm2 restart collabos-api --update-env
pm2 save
sudo cp deploy/nginx/ccacollab.com.conf /etc/nginx/sites-available/ccacollab.com
sudo nginx -t
sudo systemctl reload nginx
curl -sf https://ccacollab.com/api/healthz
curl -sI https://ccacollab.com/ | grep -i cache-control
```

## Monitoring And Alerts

Cron runs the CollabOS monitor every 15 minutes:

```cron
*/15 * * * * PM2_HOME=/home/ubuntu/.pm2 /home/ubuntu/projects/scripts/check-collabos-uptime.sh >> /home/ubuntu/logs/collabos-uptime-cron.log 2>&1
```

The monitor checks:

- PM2 status for `collabos-api`
- Local API health: `http://127.0.0.1:5015/api/healthz`
- Public API health: `https://ccacollab.com/api/healthz`
- Public SPA status: `https://ccacollab.com/`

Alerts go to Carmen by default. A controlled test was sent to Rose and Carmen with subject `Test from CollabOS`.

## Auth Recommendation

Current auth uses httpOnly secure cookies for browser sessions (preferred). Login sets `collabos_session`; logout clears it. The login JSON still includes a bearer token for one-deploy backward compatibility — clients should rely on cookies and `credentials: include`.

Rose and Carmen have scoped user management: create contributor/viewer/guest accounts and reset team passwords. They cannot create or modify admin roles. Super admin retains full user management.

Password change: `POST /api/auth/change-password` with `{ currentPassword, newPassword }`. UI in Settings → Account Security. Staff bootstrap accounts (`mustChangePassword=false`) may change optionally; admin-issued temp passwords require change.

Do not move to Supabase Auth right now unless there is a specific requirement for hosted auth, magic links, SSO, or managed user administration. Supabase Auth would be useful later if CollabOS becomes a standalone SaaS-style app, but adding it now would duplicate the current auth layer.

Legacy note: bearer tokens in browser `localStorage` were removed 2026-07-09. If an old tab fails to authenticate, sign out and sign in again.

## Shared Data Recommendation

Recommended path: keep PostgreSQL as the source for shared CollabOS state and add API-backed persistence module by module.

Why:

- PostgreSQL is already running and connected.
- The repo already uses Drizzle ORM.
- Command Center merge later will be easier if shared data stays in normal tables rather than a second hosted data model.
- It avoids Supabase platform lock-in while still leaving Supabase Postgres as an option later if a managed cloud database is preferred.

Completed shared-state areas:

1. Users, auth, audit logs, and Mockup Studio.
2. Review Queue/recommendations.
3. Innovation Lab/ideas.
4. Mind Meld items, handoffs, timeline, and feed.
5. External Intake and memory candidates.
6. Team Pulse feedback, sentiment signals, and SOPs.
7. App settings and integration status.
8. Projects, blockers, company records, decisions, automations, duplicate risks, alerts, build items, and project tasks.
9. Market Pulse signals, competitors, and executive report templates.

Before live integrations, remaining local state should stay limited to demo UX or browser session concerns.

## Workflow Test Checklist

- Log in as Rose, Carmen, admin, contributor, viewer, and guest.
- Confirm role-based access control in the UI and API.
- Confirm Mind Meld is visible only to authorized roles.
- Confirm Mockup Studio create/edit/status/version flows.
- Confirm dual Rose/Carmen approval behavior.
- Confirm audit logs are written for login, user management, and Mockup Studio actions.
- Confirm viewer/guest cannot mutate protected records.
- Confirm `/api/healthz` stays healthy after tests.

## Cursor Direct Requests Protocol

Cursor Direct Requests is the controlled handoff path for Cursor work before live integrations.

Use it for:

- Bugs, fixes, improvements, ops requests, and integration-prep tasks.
- Requests Rose or Carmen wants tracked inside CollabOS instead of only in chat.
- Execution evidence after the agent makes a change.

Agent execution rules:

1. Rose, Carmen, or an approved contributor creates a Cursor Direct Request.
2. A human triages the item and sets approval/risk.
3. Cursor should only execute items marked `approved-for-agent`, unless Rose or Carmen explicitly approves the item in chat.
4. Cursor updates the item with `in-progress`, `blocked`, `ready-for-review`, `done`, or `rejected` as work proceeds.
5. Cursor records useful evidence in the item: build/test commands, deployment status, commit/branch/MR links, caveats, and final outcome.
6. High-risk work must keep a Rose/Carmen approval route and should not be treated as automatically executable.

Operational API endpoints:

```bash
GET /api/agent-work/items
POST /api/agent-work/items
PATCH /api/agent-work/items/:id
POST /api/agent-work/items/:id/events
```

## Integrations Order

Do integrations last, after auth and shared data are stable.

Suggested order:

1. Gemini AI for approved rule/generative features.
2. Email notifications.
3. External intake webhooks such as Zoho Cliq and WhatsApp.
4. Any SMS/payment integrations only if the product scope requires them.

Do not represent test-mode integrations as live. Do not wire live external services without Rose and Carmen approval.

## Backups

CollabOS PostgreSQL is backed up daily via cron.

| Item | Value |
|------|-------|
| Schedule | Daily at **03:15 UTC** (`15 3 * * *`) |
| Script | `/home/ubuntu/projects/scripts/backup-collabos-db.sh` |
| Output directory | `/var/backups/collabos/db/` |
| Filename pattern | `collabos_staging-<UTC timestamp>.sql.gz` |
| Retention | 7 days |
| Cron log | `/home/ubuntu/logs/collabos-backup-cron.log` |
| Backup log | `/home/ubuntu/logs/collabos-backup.log` |
| Credentials | Loaded from `/home/ubuntu/projects/scripts/collabos.env` (`DATABASE_URL`) — never commit |

### Manual backup

```bash
/home/ubuntu/projects/scripts/backup-collabos-db.sh
```

### Restore (staging / disaster recovery)

Replace `<backup-file>` with the desired `.sql.gz` from `/var/backups/collabos/db/`:

```bash
set -a && source /home/ubuntu/projects/scripts/collabos.env && set +a
gunzip -c /var/backups/collabos/db/<backup-file> | psql "$DATABASE_URL"
```

Test restore on a non-production database before relying on backups for live operations.

### Restore drill log

| Date (UTC) | Result | Notes |
|------------|--------|-------|
| 2026-07-09 | **Success (partial scope)** | Restored `collabos_staging-20260709T031501Z.sql.gz` into temp DB `collabos_restore_drill` via `gunzip -c … \| sudo -u postgres psql collabos_restore_drill`. Verified row counts: 10 users, 43 projects, 48 sessions. Live DB untouched. Temp DB dropped after verification is optional — remove when done. |

Drill command used:

```bash
LATEST=$(ls -t /var/backups/collabos/db/*.sql.gz | head -1)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS collabos_restore_drill;"
sudo -u postgres psql -c "CREATE DATABASE collabos_restore_drill;"
gunzip -c "$LATEST" | sudo -u postgres psql collabos_restore_drill
sudo -u postgres psql collabos_restore_drill -c "SELECT count(*) FROM users;"
```

## Project Registry Sync

CollabOS project registry is refreshed nightly from live server state (git repos, PM2, HTTP health, Command Center cockpits).

| Item | Value |
|------|-------|
| Schedule | Daily at **03:30 UTC** (`30 3 * * *`) — after DB backup at 03:15 |
| Script | `/home/ubuntu/projects/scripts/sync-collabos-projects.sh` |
| Engine | `/home/ubuntu/projects/scripts/sync-collabos-projects.mjs` |
| Sync log | `/home/ubuntu/logs/collabos-project-sync.log` |
| Cron log | `/home/ubuntu/logs/collabos-project-sync-cron.log` |
| Credentials | Loaded from `/home/ubuntu/projects/scripts/collabos.env` (`DATABASE_URL`) |

The sync updates matched projects (status, progress, blockers, `last_synced_at`), inserts newly discovered repos, and never deletes manual entries.

### Manual sync

```bash
/home/ubuntu/projects/scripts/sync-collabos-projects.sh
```

## Demo Data Removal (2026-07-08)

Automatic workspace seeding on API startup is **disabled**. Only `ensureStaffAccountsFromEnv` runs on boot (staff promotion + demo login deactivation).

**Tables cleared** (workspace content only; Command Center tables untouched):

`recommendations`, `ideas`, `mind_meld_items`, `mind_meld_handoffs`, `mind_meld_timeline`, `mind_feed`, `intake_items`, `memory_candidates`, `feedback_items`, `sentiment_signals`, `sops`, `projects`, `project_blockers`, `project_tasks`, `build_items`, `company_records`, `decisions`, `automations`, `duplicate_risks`, `alerts`, `market_signals`, `market_competitors`, `report_templates`, `agent_work_items`, `integration_status`, `mockups`, `mockup_versions`, `audit_logs`

`app_settings` competitors/keywords reset to empty arrays. Staff users (`rose@ccacontact.com`, `carmen@ccacontact.com`, `admin@ccacontact.com`) preserved.

Seed modules remain in `artifacts/api-server/src/lib/seed-*.ts` for reference but are not invoked from `index.ts`.

## Known Caveats

- Staff sign-in uses `@ccacontact.com` accounts when `COLLABOS_PROMOTE_STAFF_ACCOUNTS=true` is set in the server env. Demo `@collabos.demo` logins are deactivated after promotion.
- Shared module state is PostgreSQL-backed; browser storage remains for demo role preference only.
- Auth uses httpOnly session cookies; bearer header retained for service integrations.
- Integrations are not live.
- This app may later merge into Command Center, but Command Center is not ready for that attachment yet.

## Staff Account Promotion

Set these in `/home/ubuntu/projects/scripts/collabos.env` (never commit real values):

```bash
COLLABOS_PROMOTE_STAFF_ACCOUNTS=true
COLLABOS_STAFF_BOOTSTRAP_PASSWORD=<secure-initial-password>
```

Then restart `collabos-api`. Rose, Carmen, and super-admin staff accounts are created or refreshed with `mustChangePassword=true`, and demo logins are deactivated.

## Standalone staff cockpit decommission (2026-07-09)

Staff cockpits are served only via Command Center at `https://command.cagteam.net/{slug}` (e.g. `tony`, `jestina`, `landon`, `chloe`, `tara`, `rose`, `carmen`).

**Nginx:** removed symlinks from `/etc/nginx/sites-enabled/` (configs kept in `sites-available`):

- `tony.cagteam.net`
- `jestina.cagteam.net`
- `landon.cagteam.net`
- `chloe.cagteam.net`
- `tara.cagteam.net`

Reload: `sudo nginx -t && sudo systemctl reload nginx`.

**PM2:** removed `jestina-api` (port 8081; only backed standalone `tony.cagteam.net` `/api/`). `pm2 save` updated.

**Left running intentionally:**

- `cca-command-center-api`, `cca-command-center-cloud`, and related CC PM2 processes
- `executive-command-api` (5026) and `lindaos-api` (5027) — proxied under `command.cagteam.net`
- `salesintelligence-api` (8082) — still used by `salestraining.cagteam.net` (not decommissioned)
- Zoho-related domains — cleanup deferred
- TLS certs under `/etc/letsencrypt/live/` not deleted

**Post-change checks:** all listed Command Center slugs and `https://ccacollab.com/` returned HTTP 200 after reload.

## Progress reflect (2026-07-10)

Registry and build plans updated to match live reality:

- Merged staff cockpits (tony/jestina/landon/chloe/tara and peers): standalone domains removed; live in Command Center.
- Command Center: integration + domain cleanup done; monitor PM2 restart count on `cca-command-center-cloud`.
- CollabOS: build plans, handoffs, human copy, cookie auth, notifications, Mind Meld create, cache-bust.
- **EC Electric PartnerConnect** added (`ec.ccacompliancepartner.com`, PM2 `ec-partnerconnect-api`).
- Rose dashboard: **Waiting on you** + **Decisions & integrations** grouped as Core & audit, Apps waiting on Rose, Cockpits / redesigns, Integrations (ComplianceCore, Audit Engine, Risk Audit, Docs Collect, Business Hub redesign, Soraya cockpit, demo→real apps, websites, Investor Boardroom, staff cockpits, WhatsApp/Cliq/email/Gemini/Zoho).

Manual build plans use `source = 'manual'` so nightly sync does not overwrite them. Re-run sync after registry edits:

```bash
/home/ubuntu/projects/scripts/sync-collabos-projects.sh
```

## Full registry resync (2026-07-10 later)

Fresh server scan (repos, PM2, nginx, HTTP health) and CollabOS project registry update:

- **Added:** VideoConnect (`ccavideoconnect.com`), CCA Client Experience (`experience.ccacontact.com`), CAG Investor Boardroom (`caginvestor.ccacontact.com`).
- **Updated to live reality:** Audit Risk Model (`audit.cagteam.net` + `cca-audit-api`), Discovery/intake (`intake.ccacontact.com`), Facility Intelligence demo, Compliance Connect prod+demo hosts, CAG/CCA public websites and contractor landing, ExamManagerOS / FRR / EC progress honesty.
- Rose Decisions cards refreshed for websites, both investor rooms, Discovery intake URL, Client Experience, and live Risk Audit hosting.
- Sync script: `lockProgress` for honest %; copy kept in both `collabos/scripts/` and `projects/scripts/`.

## ALD / AI audits / server cleanup (2026-07-10)

Active workstreams reflected honestly from server evidence + Rose/Carmen direction:

- **American Leak Detection (ALD):** project check in progress. PartnerConnect room content in EC stack (`american-leak-detection`; path on `ec.ccacompliancepartner.com`). Same PartnerConnect family as FRR/EC. Dedicated `ald.ccacompliancepartner.com` not confirmed as a separate live host.
- **AI Audits:** `cca-research-hub-ai-audit-worker` online; Research Hub at `research.cagteam.net`. Findings may need Rose review — not closed.
- **Server cleanup:** cockpit domain decommission **done** (2026-07-09). Further deleting old servers / leftover cleanup **ongoing**; no invented deletion list — approve before removals.
- Rose dashboard: **Active checks & cleanup** group + AI Audits under Core & audit.
- Registry: ALD, AI Audits, Server Cleanup EXTRA entities; Research Hub description/progress updated for AI audit worker.
