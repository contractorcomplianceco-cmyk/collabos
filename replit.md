# CollabOS Command Center

A collaboration-intelligence internal OS that helps two founders (Rose & Carmen) and their team align on ideas, surface duplicate work, route decisions for approval, and synthesize their two perspectives in a private Mind Meld Room. Real backend auth + persisted Mockup Studio; most module state remains local-first (localStorage).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

The frontend lives in the `roseos` artifact (`artifacts/roseos`, slug `@workspace/roseos`, previewPath `/`, web port 25533), a React + Vite SPA. The backend is `artifacts/api-server` (Express 5, `/api/*`), using `lib/db` (Drizzle schemas: users, sessions, mockups, mockupVersions, auditLogs).

**Backend (api-server routes, all under `/api`):**
- `auth.ts` — login/logout/me: bcryptjs password check, DB-backed session tokens, cookie sessions verified on every request.
- `users.ts` — user management CRUD + reset-password, gated by `requirePermission("user_management")`.
- `auditLogs.ts` — audit log list + append; important actions are written server-side.
- `mockups.ts` — persisted Mockup Studio: CRUD + `/status` transitions + `/versions`; server enforces status transitions and dual (Rose+Carmen) approval; gated by `mockup_studio_view` / `mockup_studio_edit` permissions.
- 7 seeded demo accounts (rose@collabos.demo, carmen@, admin@, lena@, devon@, viewer@, guest@ — shown on the login page, labeled as demo credentials).

**Frontend (`artifacts/roseos/src`):**
- `src/App.tsx` — shell: AuthGate (login page for anon), sidebar nav, top bar (palette trigger, alerts bell), context-aware Rose Brain drawer, wouter routing (base = `import.meta.env.BASE_URL`), Command Palette (⌘K/Ctrl+K or click search: role-filtered module jump + rule-based smart actions — classify text, duplicate check, save draft idea via `canSubmit`, start mockup; honest "rule-based draft" labeling).
- `src/hooks/use-auth.tsx` — real auth state (login/logout/me against `/api`), `hasPermission`, server-role → UI-role mapping (`mapServerRole`).
- `src/pages/login.tsx`, `user-management.tsx`, `audit-logs.tsx` — auth + admin pages (admin pages guarded by `AdminGuarded` permission checks; server enforces too).
- `src/pages/mockup-studio.tsx` — persisted creative engine: gallery + create from scratch/intake/ideas/meld, editor tabs (brief/screens/visual/review/versions), wireframe block library, A/B version compare, approval gated by `mockup_approve_rose/carmen` perms; statuses draft → needs_*_review → approved_for_build / sent_back / archived — never auto-approved.
- `src/pages/*` — one file per module. `mind-meld.tsx` is the permission-gated centerpiece (6 view tabs + 10 innovative functions).
- `src/hooks/use-app-state.tsx` — single app store + localStorage persistence (key `roseos_state_v1`). Source of truth for all mutable state.
- `src/lib/helpers.ts` — pure logic helpers (permissions, approval routing, similarity, etc.); tested in `src/lib/helpers.test.ts`.
- `src/types/index.ts` — all TypeScript domain types (source of truth for the data model).
- `src/data/seed.ts` — all seed data (people, projects, ideas, recommendations, mind-meld items, handoffs, alerts, reports, market signals, integrations, default settings).
- `src/components/shared.tsx` — shared UI primitives (SectionCard, StatusChip, RiskBadge, Donut, LockedState, KpiWidget w/ optional `delta` pill, etc.).
- `src/assets/collabos-logo.png` — full CollabOS Command Center logo lockup (flower mark + wordmark), shown centered in the sidebar header. Import via `@/assets/collabos-logo.png` (resolves in both Vite and tsc); do NOT use the `@assets` alias for typechecked imports. Old `rose-logo.png` is unused.
- Dashboard matches the "Welcome back" layout (greeting + 4 delta stat cards + module grid). Mind Meld Room's default "room" tab matches its mockup (Rose View · Alignment center w/ 10 function tiles · Carmen View + right rail: Decision Heatmap / Handoff History / Private Room Status). Other Mind Meld tabs (rose/carmen/board/handoff/notes) use the fallback branch.
- `src/index.css` — theme tokens + `@layer components` utilities (e.g. `.field-input`).
- External Intake (`src/pages/external-intake.tsx`, route `/external-intake`): message intake from Zoho Cliq / WhatsApp / manual test entry. Rule-based intelligence lives in `helpers.ts` (`classifyIntakeMessage` w/ `reason`, `classifyIntakeSensitivity`, `summarizeIntakeMessage`, `detectIntakeDuplicates`, `computeIntakeReadiness`, `detectIntakeFriction`, `generateBuildPrompt`). Routing (`routeIntakeItem` in the store, supports `ownerOverride`) is draft-only: mind-meld → private leadership-only MindMeldItem (safe summary only), idea-backlog → draft Idea, no-action → archived, everything else → pending Recommendation (category `"external-intake"`, requiredApprover mapped from reviewOwner: Rose→rose, Carmen→carmen, else both). Nothing is ever auto-approved. Integration settings expose off/test/live modes with live disabled (frontend-only; honest test-mode labeling required — never claim a live integration exists).
- External Intake advanced features: Collab Constellation tab (clusters items by related project), readiness meter + friction detector chips/filters, "What is this?" classification-reason card, magic actions (Carmenfy / Rosify / Check for Duplicates / Do Not Forget This → `addMemoryCandidate`, status proposed/approved/rejected — never auto-written to any brain), merge suggestion panel, instant build prompt generator. Access control: `canSubmit(role)` gates ALL mutation UI + action handlers (Viewer is view-only, incl. integration mode toggles/test webhooks); `canViewSensitive(role)` redacts sensitive items ("Restricted — leadership review only") in queue cards, constellation, detail panel, and the dashboard attention cockpit.
- Mind Meld Room has a Meld Timeline view (`meldTimeline` in store; needs/ready-to/sensitive/finalized filters). Dashboard has a "What Needs My Attention?" cockpit (approvals awaiting me via `canApprove` + `approvals.rose/carmen`, new intake, duplicate flags, meld threads needing my take, proposed memory candidates — leadership-only items gated by role) with an Attention Pulse chip (calm/active/high).
- High-tech UX layer: `ApprovalPassport` (read-only rose/carmen approval stamps, handles `requiredApprover: "none"`) shown on Review Queue cards; `EmptyState` supports `hint`/`action` for smart empty states; Innovation Lab has per-idea "Grow into" expansion chips (product/workflow/automation/mockup/sales) powered by `expandIdeaConcept` in `helpers.ts` (rule-based, copy-draft + Mockup Studio link, never auto-approved).

## Architecture decisions

- Hybrid architecture: auth, users, audit logs, and Mockup Studio are REAL backend features (api-server + Postgres, sessions verified per request, permissions enforced server-side). Everything else stays local-first: seeded in `src/data/seed.ts`, persisted to localStorage (`roseos_state_v1`).
- 7-role RBAC on the server (founder_admin ×2, super_admin, leadership_reviewer, contributor, viewer, guest) mapped to UI roles via `mapServerRole`. UI-side permission helpers live in `src/lib/helpers.ts` (`canApprove`, `canAccessMindMeld`, `canViewSensitive`, `canSubmit`).
- Read-only roles are enforced in the store too, not just the UI: `updateIdeaStatus` and `setRecommendationStatus` no-op for roles failing `canSubmit`/`canApprove` guards.
- The Mind Meld Room is gated to Rose / Carmen / Admin only via `canAccessMindMeld`; everyone else sees `LockedState`.
- Dual approval is enforced in the store, not the button: a recommendation whose `requiredApprover === "both"` only finalizes to `approved` once BOTH Rose and Carmen have approved (tracked in `recommendation.approvals`). A single approval leaves it `pending` with a "awaiting X" indicator. Admin counts as both.
- Visual language: clean white, rose/coral + electric blue accents, pastel chips, lucide-react icons, no emojis, no dark theme.

## Product

11 sidebar modules: Collab Dashboard, Duplicate Radar, Team Pulse, Solution Finder, Innovation Lab, Mockup Studio, Executive Reports, Market Pulse, Mind Meld Room, Review Queue, Settings. Key capabilities: duplicate-work detection, team sentiment, AI recommendations routed through a central approval queue (never auto-approved), classification/safety badges, a context-aware Rose Brain assistant drawer, and the private Mind Meld Room where Rose & Carmen's two perspectives are synthesized with 10 innovative functions, an alignment meter, and a decision heatmap.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Verify frontend with `pnpm --filter @workspace/roseos run typecheck` and `pnpm --filter @workspace/roseos run test`, NOT `build` (build needs workflow-provided `PORT`/`BASE_PATH`). Run/preview via the `artifacts/roseos: web` workflow, never `pnpm dev` from root.
- api-server has NO hot reload — restart the `artifacts/api-server: API Server` workflow after server changes; test with curl via `localhost:80/api/...` (shared proxy), never the raw port.
- Tests are required for the helpers in `src/lib/helpers.test.ts` (currently 52 passing, incl. intake classifier/duplicate/summary/readiness/friction/build-prompt, mockup studio, and idea-expansion tests). Keep them green.
- The `roseos` package still lists `@workspace/api-client-react` as a dependency but does not use it (harmless).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
