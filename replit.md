# RoseOS Collab Command Center

A local-first (no backend) collaboration-intelligence internal OS that helps two founders (Rose & Carmen) and their team align on ideas, surface duplicate work, route decisions for approval, and synthesize their two perspectives in a private Mind Meld Room.

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

The whole product lives in the `roseos` artifact (`artifacts/roseos`, slug `@workspace/roseos`, previewPath `/`, web port 25533). It is a standalone React + Vite SPA — it does NOT use the api-server, db, or api-spec packages.

- `src/App.tsx` — shell: sidebar nav (11 modules), top bar (search, alerts bell, role selector), context-aware Rose Brain drawer, wouter routing (base = `import.meta.env.BASE_URL`).
- `src/pages/*` — one file per module. `mind-meld.tsx` is the permission-gated centerpiece (6 view tabs + 10 innovative functions).
- `src/hooks/use-app-state.tsx` — single app store + localStorage persistence (key `roseos_state_v1`). Source of truth for all mutable state.
- `src/lib/helpers.ts` — pure logic helpers (permissions, approval routing, similarity, etc.); tested in `src/lib/helpers.test.ts`.
- `src/types/index.ts` — all TypeScript domain types (source of truth for the data model).
- `src/data/seed.ts` — all seed data (people, projects, ideas, recommendations, mind-meld items, handoffs, alerts, reports, market signals, integrations, default settings).
- `src/components/shared.tsx` — shared UI primitives (SectionCard, StatusChip, RiskBadge, Donut, LockedState, etc.).
- `src/index.css` — theme tokens + `@layer components` utilities (e.g. `.field-input`).

## Architecture decisions

- Local-first prototype: no backend, no API calls. All state is seeded in `src/data/seed.ts` and persisted to localStorage. The api-server/db/api-spec packages exist in the monorepo but are unused by RoseOS.
- Role-based permissions live in `src/lib/helpers.ts` (`canApprove`, `canAccessMindMeld`, `canViewSensitive`, `canSubmit`). Roles: Rose, Carmen, Admin, Department Lead, Team Member, Viewer.
- The Mind Meld Room is gated to Rose / Carmen / Admin only via `canAccessMindMeld`; everyone else sees `LockedState`.
- Dual approval is enforced in the store, not the button: a recommendation whose `requiredApprover === "both"` only finalizes to `approved` once BOTH Rose and Carmen have approved (tracked in `recommendation.approvals`). A single approval leaves it `pending` with a "awaiting X" indicator. Admin counts as both.
- Visual language: clean white, rose/coral + electric blue accents, pastel chips, lucide-react icons, no emojis, no dark theme.

## Product

11 sidebar modules: Collab Dashboard, Duplicate Radar, Team Pulse, Solution Finder, Innovation Lab, Mockup Studio, Executive Reports, Market Pulse, Mind Meld Room, Review Queue, Settings. Key capabilities: duplicate-work detection, team sentiment, AI recommendations routed through a central approval queue (never auto-approved), classification/safety badges, a context-aware Rose Brain assistant drawer, and the private Mind Meld Room where Rose & Carmen's two perspectives are synthesized with 10 innovative functions, an alignment meter, and a decision heatmap.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- RoseOS is a frontend-only SPA. Verify with `pnpm --filter @workspace/roseos run typecheck` and `pnpm --filter @workspace/roseos run test`, NOT `build` (build needs workflow-provided `PORT`/`BASE_PATH`). Run/preview via the `artifacts/roseos: web` workflow, never `pnpm dev` from root.
- Tests are required for the helpers in `src/lib/helpers.test.ts` (currently 16 passing). Keep them green.
- The `roseos` package still lists `@workspace/api-client-react` as a dependency but does not use it (harmless).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
