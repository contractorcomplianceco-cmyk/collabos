---
name: Access-control review bar for CollabOS
description: What the architect review requires before role-gating/sensitive-redaction changes pass
---
The rule: role gating must be enforced at BOTH the UI layer (hide/disable controls) AND inside every action handler (early return when the role lacks permission). Sensitive-item redaction must cover every surface that renders the content — including secondary surfaces like dashboard attention cards, not just the owning page.

**Why:** Architect review failed twice on the External Intake feature: first for UI-only gating (a role-switch after opening a form could still mutate state), then for a sensitive summary leaking on the Dashboard cockpit. Only handler-level guards + full-surface redaction passed.

**How to apply:** When adding any mutation or sensitive display in this app, gate the UI with `canSubmit(role)` / `canViewSensitive(role)` from helpers AND guard the handler itself; then grep for every place the same data is rendered (dashboard, drawers, lists) and redact there too.
