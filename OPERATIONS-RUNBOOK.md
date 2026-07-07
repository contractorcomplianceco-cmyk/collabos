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
- Auth: app-owned users and database-backed bearer session tokens.
- Shared module state: PostgreSQL + Express API backed for the main CollabOS workspace modules. Browser `localStorage` is limited to the demo role preference and auth token storage.

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
sudo nginx -t
sudo systemctl reload nginx
```

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
sudo nginx -t
sudo systemctl reload nginx
curl -sf https://ccacollab.com/api/healthz
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

Recommended path for now: keep the current app-owned auth and bearer sessions.

Why:

- It is already working and verified.
- It is cheapest because it uses the existing Express API and PostgreSQL database.
- It is fastest because there is no new auth vendor, no migration, and no extra integration surface.
- It keeps future Command Center merge simpler because users, roles, sessions, and audit logs already live in the app database.

Do not move to Supabase Auth right now unless there is a specific requirement for hosted auth, magic links, SSO, or managed user administration. Supabase Auth would be useful later if CollabOS becomes a standalone SaaS-style app, but adding it now would duplicate the current auth layer.

Security improvement to consider next: move the bearer token out of browser `localStorage` into an httpOnly secure cookie. That is better against token theft from browser script, but it is a code change and should be approved as an auth-hardening task.

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

Before real use, add a database backup job for `collabos_staging` and confirm restore steps.

Minimum backup expectation:

- Daily `pg_dump` to `/var/backups/collabos/db/`
- Keep at least 7 days
- Store secrets outside git
- Test restore before relying on the app for live operations

## Known Caveats

- Staff sign-in uses `@ccacontact.com` accounts when `COLLABOS_PROMOTE_STAFF_ACCOUNTS=true` is set in the server env. Demo `@collabos.demo` logins are deactivated after promotion.
- Shared module state is PostgreSQL-backed; browser storage remains for auth token and demo role preference.
- Auth currently uses bearer tokens in browser `localStorage`.
- Integrations are not live.
- This app may later merge into Command Center, but Command Center is not ready for that attachment yet.

## Staff Account Promotion

Set these in `/home/ubuntu/projects/scripts/collabos.env` (never commit real values):

```bash
COLLABOS_PROMOTE_STAFF_ACCOUNTS=true
COLLABOS_STAFF_BOOTSTRAP_PASSWORD=<secure-initial-password>
```

Then restart `collabos-api`. Rose, Carmen, and super-admin staff accounts are created or refreshed with `mustChangePassword=true`, and demo logins are deactivated.
