---
name: RoseOS asset imports
description: How to import image assets so both Vite and tsc resolve them in the roseos artifact
---

# Importing image assets in roseos

Import assets via the `@/assets/...` path (e.g. `import roseLogo from "@/assets/rose-logo.png"`).

**Why:** `@/*` maps to `./src/*` in both `vite.config.ts` resolve.alias AND `tsconfig.json` paths, and `vite/client` types (in `tsconfig` `types`) declare `*.png` modules — so the import resolves at build time and typechecks.

**How to apply:** Put assets under `artifacts/roseos/src/assets/`. Do NOT import via the `@assets` alias for code that is typechecked — `@assets` exists in vite.config (points to repo `attached_assets/`) but is NOT in `tsconfig.json` paths, so `tsc` will fail to resolve it.
