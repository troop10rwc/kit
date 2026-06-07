<!-- Paste the block below into each consuming repo's CLAUDE.md (e.g. scoutpack,
     calendar). Keep it short — it's a pointer to the canonical STACK.md, not a copy. -->

## Shared stack: @troop10rwc/kit

This app is built on the shared Troop 10 RWC stack (Vite + React 19 + Hono +
Cloudflare Workers + D1, behind Cloudflare Access). **Reuse the kit — don't
reinvent UI, types, or Worker auth.**

- `@troop10rwc/ui` — back-office components + `--t10-*` design tokens. Building
  any back-office page? Follow the design contract at
  `node_modules/@troop10rwc/ui/STYLE.md` (the five interaction models; one primary
  action per view; preview any write the user didn't type field-by-field).
- `@troop10rwc/shared` — shared types (`Role`, `Position`, `Changeset`). Import
  contracts from here; don't redefine them.
- `@troop10rwc/worker-kit` — Access JWT verify, roster role, Hono middleware
  (`withAuth`, `requireLeader`). Role comes from the roster (D1), not the raw claim.

Entry wiring (order matters):

```ts
import "@troop10rwc/ui/fonts.css";
import "@troop10rwc/ui/theme.css";
```

Install/auth uses GitHub Packages — see `.npmrc` (`NPM_TOKEN` = `GITHUB_TOKEN` in
CI, a PAT locally). Canonical docs: https://github.com/troop10rwc/kit/blob/main/STACK.md

Agents: for the full setup and design contract, the kit ships a Claude Code
plugin — `/plugin marketplace add troop10rwc/kit` then `/plugin install
troop10-kit@troop10rwc` (skills `consume-kit`, `backoffice-style`).
