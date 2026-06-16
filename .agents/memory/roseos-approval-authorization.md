---
name: RoseOS approval authorization
description: Where approval permission must be enforced when adding controls that change recommendation status
---

Any control that mutates a recommendation's approval status must be gated by `canApprove(role, requiredApprover)` in BOTH places:

1. **UI** — render approve/reject only when `canApprove` is true; otherwise show a read-only "Requires <route>" pill (the Review Queue page already did this; a newly-added Dashboard Review Queue widget did not, letting any role approve).
2. **Store mutator** — `setRecommendationStatus` in `use-app-state.tsx` must early-return the unchanged recommendation when `!canApprove(actor, r.requiredApprover)`, as defense-in-depth so a missing UI guard can't bypass the permission model.

**Why:** the store had no authorization check, so wiring buttons straight to `setRecommendationStatus` was a broken-access-control regression (non-approvers could approve).
**How to apply:** whenever you add a new surface that calls `setRecommendationStatus`, gate the UI and trust the store guard as backstop. Seed recommendations only use rose/carmen/both routes (no "none"), so the guard never wrongly blocks legitimate seed data.
