# Troop 10 RWC — shared stack

The canonical reference for how Troop 10 RWC apps are built and how they share
code. **This file is the source of truth other repos link to** — don't copy its
contents into each app (that drifts); link here and keep per-repo docs to a short
pointer (see [Per-repo setup](#per-repo-setup)).

## The stack

Every app (scoutpack and friends) is the same shape:

- **Client:** Vite + React 19, hand-written CSS (no CSS-in-JS, no UI framework).
- **Edge:** Hono on Cloudflare Workers (`workerd` — WebCrypto/fetch globals, no
  node builtins).
- **Data:** Cloudflare D1.
- **Auth:** behind Cloudflare Access; the effective role is derived from the
  **roster** (D1), not the raw OIDC claim.

Shared building blocks live in [`@troop10rwc/kit`](https://github.com/troop10rwc/kit),
published to **GitHub Packages**, split by runtime so React stays out of Worker
bundles and DOM types stay out of edge code:

| Package | Runtime | Owns |
|---|---|---|
| `@troop10rwc/shared` | neutral | types/contracts: `Role`, `Position`, `LEADER_POSITIONS`, `Identity`, `Change`, `Changeset` |
| `@troop10rwc/ui` | React 19 (DOM) | back-office components + `theme.css` / `fonts.css` design tokens + `STYLE.md` |
| `@troop10rwc/worker-kit` | Workers (`workerd`) | `verifyAccessJwt`, `roleForPosition`, `withAuth`, `requireLeader` |

**Reuse these.** Don't redefine the shared types, re-style the components, or
re-implement Access auth per app.

## Design contract

The back office follows one design system — the **five interaction models**,
`--t10-*` tokens, and the component catalog — documented in
[`packages/ui/STYLE.md`](packages/ui/STYLE.md). It ships with the `ui` package,
so in a consuming app it's at `node_modules/@troop10rwc/ui/STYLE.md`. Read it
before building a back-office page. New components extend the contract in the same
PR; treat drift as a bug.

## Consuming the kit

The packages are **public**, but GitHub Packages' npm registry has **no
anonymous access** — a token is always required.

1. Add `.npmrc` at the app root (see [`consumer.npmrc.example`](consumer.npmrc.example)):

   ```ini
   @troop10rwc:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```

   - **CI:** `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — works from any repo, no
     scopes or per-repo grants.
   - **Local:** any classic PAT exported as `NPM_TOKEN` (or in your user `~/.npmrc`).
   - A `401/403 … does not match expected scopes` means the token/`.npmrc` is
     missing — not a visibility problem.

2. Install:

   ```bash
   pnpm add @troop10rwc/ui @troop10rwc/shared      # client
   pnpm add @troop10rwc/worker-kit                  # worker side
   ```

3. Wire the UI once in the app entry — **order matters** (fonts, then tokens):

   ```ts
   import "@troop10rwc/ui/fonts.css";
   import "@troop10rwc/ui/theme.css";
   import { AppShell, DataTable, Drawer } from "@troop10rwc/ui";
   ```

4. Wire Worker auth with `withAuth` / `requireLeader`. `verifyAccessJwt` is
   currently a **stub** — port the WebCrypto RS256 verification from the app's
   `src/worker/auth.ts` before relying on it. `teamDomain`/`audience` come from
   env/config; never hard-code or bundle them.

5. Keep current: point **Renovate/Dependabot** at `@troop10rwc/*` so kit bumps
   arrive as PRs (the low-maintenance substitute for a monorepo's atomic updates).

## Claude Code plugin

This repo doubles as a **Claude Code plugin marketplace**, so agents working in
any consuming repo know the stack and design contract. Install once per machine:

```
/plugin marketplace add troop10rwc/kit
/plugin install troop10-kit@troop10rwc
```

It bundles two skills:

- **`/troop10-kit:consume-kit`** — wiring the kit into an app (registry auth,
  install, entry imports, Worker auth).
- **`/troop10-kit:backoffice-style`** — the `STYLE.md` design contract for
  building/reviewing back-office pages on-style.

The plugin source lives in [`plugins/troop10-kit/`](plugins/troop10-kit/); the
`backoffice-style` skill points at the canonical `STYLE.md`, so keep it in sync
when the design system changes.

## Adopting the kit in a repo

Two steps. **Don't copy this STACK.md into the app** — it's the kit's canonical
doc; copying drifts. The app keeps its own docs and just *points* here.

**1. Register the plugin (so an agent can do the rest).** Either run it once per
machine:

```
/plugin marketplace add troop10rwc/kit
/plugin install troop10-kit@troop10rwc
```

…or commit it to the repo so it auto-loads for anyone who trusts the workspace —
add to the app's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "troop10rwc": { "source": { "source": "github", "repo": "troop10rwc/kit" } }
  },
  "enabledPlugins": { "troop10-kit@troop10rwc": true }
}
```

**2. Run the prep skill** in the app repo:

```
/troop10-kit:consume-kit
```

It detects the package manager, writes `.npmrc`, installs the packages, wires the
entry CSS imports, appends the kit pointer to `CLAUDE.md`, registers the plugin at
the repo level, and verifies — then reports what changed and leaves the commit to
you. (All of that is also written out in [Consuming the kit](#consuming-the-kit)
if you'd rather do it by hand.)

> **Swapping a repo's *existing* local code onto the kit** (e.g. replacing a local
> `src/shared` or `src/worker/auth.ts` with `@troop10rwc/shared` / `worker-kit`)
> is a deliberate migration with its own testing — not part of the basic prep.
