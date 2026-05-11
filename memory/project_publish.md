---
name: Publishing requirement
description: Must use pnpm publish, not npm publish, for workspace protocol dependency resolution
type: project
---

Must use `pnpm publish` (not `npm publish`) when releasing packages.

**Why:** `astro-site-shell` depends on `site-shell-core` with `workspace:^0.2.0`. pnpm automatically replaces the `workspace:` prefix with the actual version on publish. Using `npm publish` directly would leave `workspace:` in the published package.json, breaking installs for external users.

**How to apply:** Always remind to use `pnpm publish --filter <package-name>` when releasing.
