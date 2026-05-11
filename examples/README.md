# examples

A local Astro site for manually testing `astro-site-shell` and `site-shell-core` during development.  
It references both packages via `workspace:*`, so any local changes are reflected immediately without publishing.

## Usage

```bash
# from the workspace root
pnpm --filter examples dev
```

Open http://localhost:4321 in your browser.
