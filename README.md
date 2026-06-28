# @troop10rwc/kit

Shared building blocks for Troop 10 RWC apps (scoutpack and future tools on the
same Vite + Hono + Workers + D1 stack). One repo, three published packages on
**GitHub Packages**:

| Package | Runtime | What it holds |
|---|---|---|
| `@troop10rwc/shared` | neutral | types/contracts shared by client + worker (roles, `Changeset`) — zero deps |
| `@troop10rwc/ui` | DOM / React 19 | the back-office component library + `theme.css` + `fonts.css` |
| `@troop10rwc/worker-kit` | workerd | `requireSession` + D1 session helpers, roster roles, Hono middleware (legacy Access JWT verify kept until apps migrate) |

Split by runtime on purpose: this keeps React out of Worker bundles and DOM
types out of edge code. The design system itself is documented in
`packages/ui/STYLE.md` (the contract for new pages).

> **Sharing with the other apps?** [`STACK.md`](STACK.md) is the canonical guide
> for consuming the kit across repos (auth, install, wiring). This repo is also a
> **Claude Code plugin marketplace** — `/plugin marketplace add troop10rwc/kit`
> then `/plugin install troop10-kit@troop10rwc` gives agents the setup +
> design-contract skills. Per-repo `CLAUDE.md` pointer: [`docs/CLAUDE.snippet.md`](docs/CLAUDE.snippet.md).

## Layout

```
kit/
├── package.json            # npm workspaces, lockstep release scripts
├── tsconfig.base.json
├── consumer.npmrc.example  # drop into each app repo as .npmrc
├── .github/workflows/release.yml
└── packages/
    ├── shared/      src/index.ts
    ├── ui/          theme.css  fonts.css  src/{index,primitives,DataTable,Drawer,CommandPalette,ChangesetReview,AppShell}.tsx
    └── worker-kit/  src/index.ts
```

## Local development (inside this repo)

This repo uses **pnpm** (pinned via `packageManager` in `package.json`; a
`preinstall` guard rejects npm/yarn). Enable it with `corepack enable` if you
don't have pnpm.

```bash
pnpm install         # links the three packages together via the pnpm workspace
pnpm build           # tsup builds all (-r runs the dependency graph in order)
pnpm typecheck
```

No registry auth is needed for internal work — the workspace links locally.
`worker-kit` depends on `shared` via the `workspace:^` protocol, so pnpm always
uses the local copy and rewrites it to a real version range at publish time.

## Cross-repo dev loop (the part a monorepo would have hidden)

When iterating on `ui` and testing inside an app repo *before* cutting a release,
use **yalc** — it copies into the app's `node_modules` rather than symlinking, so
you don't get the duplicate-React crash that `npm link` causes.

```bash
npm i -g yalc

# in kit/packages/ui
pnpm build && yalc publish

# in the app repo (e.g. scoutpack)
yalc add @troop10rwc/ui      # first time
# ...after each change in kit:
cd kit/packages/ui && pnpm build && yalc push   # auto-updates the app
```

`yalc remove @troop10rwc/ui` in the app, then a normal `npm install`, restores
the published version.

## Publishing (GitHub Packages)

Versioning is **lockstep** — all three packages move together, which avoids the
"version already exists" failures of per-package publishing and keeps things
simple for a solo maintainer.

```bash
pnpm release:minor     # or release:patch
# = scripts/bump.mjs bumps all packages + root to one version, commits,
#   creates tag vX.Y.Z, and pushes with the tag -> the release workflow runs
#   `pnpm -r publish` to GH Packages (rewriting workspace:^ to a real range).
```

(pnpm has no native recursive `version`, so `scripts/bump.mjs` does the lockstep
bump; everything else is plain pnpm.)

The workflow authenticates with the built-in `GITHUB_TOKEN` (it has
`packages: write` for this repo), so no PAT is needed on the publish side.
This repo is **public**, so new publishes are public too; any GitHub token can
then install them (see Consuming below).

For changelogs later, adopt **Changesets**; it's overkill at two consumers today.

## Consuming from an app repo

1. Copy `consumer.npmrc.example` to `.npmrc` in the app. The packages are
   **public**, so any GitHub token works as `NPM_TOKEN` — in CI just use
   `${{ secrets.GITHUB_TOKEN }}`; locally use any classic PAT. (GitHub Packages'
   npm registry still requires *some* token even for public packages — there's no
   anonymous install.) pnpm reads the same `.npmrc`.
2. Install (pnpm):
   ```bash
   pnpm add @troop10rwc/ui @troop10rwc/shared
   pnpm add @troop10rwc/worker-kit            # in the worker side
   ```
3. Wire the UI once in the app entry (order matters — fonts, then tokens):
   ```ts
   import "@troop10rwc/ui/fonts.css";
   import "@troop10rwc/ui/theme.css";
   import { AppShell, DataTable, Drawer } from "@troop10rwc/ui";
   ```
   React is a peer dependency — the app's own React 19 satisfies it.
4. Keep the two apps current automatically: point **Renovate** or **Dependabot**
   at them so `@troop10rwc/*` bumps arrive as PRs. That's the low-maintenance
   substitute for a monorepo's atomic updates.

## Migrating to v0.8.0 (top-nav: dashboard brand + Profile link)

v0.8.0 changes `BackOfficeTopNav` (in `@troop10rwc/ui`):

- The **T10 brand logo** now always points at the dashboard —
  `DASHBOARD_URL` = `https://troop10rwc.org/dashboard` (its own app on the apex
  domain) — instead of the active app's own home.
- The signed-in section is now a stacked block: the **user's name** with a
  **Profile** link underneath that goes to `ACCOUNT_URL` =
  `https://id.troop10rwc.org/manage` (account management). The old
  "Signed in as …" text is gone.
- Both destinations are exported constants with optional `dashboardUrl` /
  `profileUrl` prop overrides (use them only for preview/staging).

`troop10rwc.org/dashboard` (dashboard) and `id.troop10rwc.org` (account info)
are now **distinct apps** — see [`STACK.md`](STACK.md#domains--navigation).

### Each dependent project

**1. Every consuming app (scoutpack and friends)** — pick up the new nav. No
code change is required if you render `BackOfficeTopNav` with the standard
`active` / `user` / `logoutUrl` props; the new brand target and Profile link
come for free:

```bash
# in the app repo
pnpm update @troop10rwc/ui@^0.8.0 @troop10rwc/shared@^0.8.0
pnpm update @troop10rwc/worker-kit@^0.8.0      # worker side, if used
```

- Delete any local "Signed in as …" markup or a hand-wired brand link — the kit
  owns both now.
- Previews can't reach the apex/id cookies, so override there if needed:
  ```tsx
  <BackOfficeTopNav active="expenses" user={me} logoutUrl={logoutUrl}
    dashboardUrl={isPreview ? "/" : undefined}
    profileUrl={isPreview ? "/manage" : undefined} />
  ```

**2. The `id` (member-hub) project** — split account from dashboard:

- Keep account management at **`id.troop10rwc.org/manage`** (the Profile target):
  Slack enrollment, passkeys/devices, profile. Add the `/manage` route if it
  isn't there yet.
- Stand up the **dashboard as a separate Worker on the apex domain**, routed at
  `troop10rwc.org/dashboard` (it may live in the same repo as a second Worker):
  ```bash
  # in the id repo, e.g. workers/dashboard/wrangler.toml
  #   name = "troop10-dashboard"
  #   routes = [{ pattern = "troop10rwc.org/dashboard*", zone_name = "troop10rwc.org" }]
  npx wrangler deploy --config workers/dashboard/wrangler.toml
  ```
  Protect it with `requireSession` from `@troop10rwc/worker-kit` like any other
  back-office Worker.

## Auth model

Apps authenticate with **`requireSession`**: a self-hosted scheme that replaces
Cloudflare Access. **Slack OIDC** is the one-time enrollment gate
(workspace-locked) and **passkeys (WebAuthn)** are the daily driver; sessions are
**opaque tokens stored in a D1 `sessions` table** (instant revocation), carried in
a `__Secure-` cookie scoped to `Domain=troop10rwc.org` so SSO works across
subdomains. The Slack legs, passkey ceremonies, and the `/profile` "my devices"
page live in the standalone **member-hub Worker at `id.troop10rwc.org`** (apps
redirect unauthenticated requests there via `authOrigin`); this kit ships the
Worker-side middleware and session helpers (`requireSession`, `d1SessionLookup`,
`buildSessionCookie`/`clearSessionCookie`, `SESSION_COOKIE_NAME`,
`SESSION_MAX_AGE`). `requireSession` attaches `c.var.session` (`{ sub, name?,
email? }`); the roster role is keyed by the member's **email**, the reliable
identity key.

The legacy Access path (`withAuth`, `verifyAccessJwt`) stays exported until each
app migrates — see [`STACK.md`](STACK.md#consuming-the-kit) for wiring.

## Porting notes

`worker-kit` ships real `roleForPosition`/`requireLeader` logic plus **stubs**
for the legacy `verifyAccessJwt` and `withAuth`. For apps still on Access, move
your existing implementations from `src/worker/auth.ts` (WebCrypto RS256) and
`src/worker/roster.ts` (D1 lookup) into them, then delete the per-app copies so
both apps share one. New apps should wire `requireSession` instead.
