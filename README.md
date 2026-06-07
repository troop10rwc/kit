# @troop10rwc/kit

Shared building blocks for Troop 10 RWC apps (scoutpack and future tools on the
same Vite + Hono + Workers + D1 stack). One repo, three published packages on
**GitHub Packages**:

| Package | Runtime | What it holds |
|---|---|---|
| `@troop10rwc/shared` | neutral | types/contracts shared by client + worker (roles, `Changeset`) — zero deps |
| `@troop10rwc/ui` | DOM / React 19 | the back-office component library + `theme.css` + `fonts.css` |
| `@troop10rwc/worker-kit` | workerd | Access JWT verify, roster roles, Hono middleware |

Split by runtime on purpose: this keeps React out of Worker bundles and DOM
types out of edge code. The design system itself is documented in
`packages/ui/STYLE.md` (the contract for new pages).

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

```bash
npm install          # symlinks the three packages together via workspaces
npm run build        # tsup builds all (shared first — it's listed first)
npm run typecheck
```

No registry auth is needed for internal work — workspaces link locally.

## Cross-repo dev loop (the part a monorepo would have hidden)

When iterating on `ui` and testing inside an app repo *before* cutting a release,
use **yalc** — it copies into the app's `node_modules` rather than symlinking, so
you don't get the duplicate-React crash that `npm link` causes.

```bash
npm i -g yalc

# in kit/packages/ui
npm run build && yalc publish

# in the app repo (e.g. scoutpack)
yalc add @troop10rwc/ui      # first time
# ...after each change in kit:
cd kit/packages/ui && npm run build && yalc push   # auto-updates the app
```

`yalc remove @troop10rwc/ui` in the app, then a normal `npm install`, restores
the published version.

## Publishing (GitHub Packages)

Versioning is **lockstep** — all three packages move together, which avoids the
"version already exists" failures of per-package publishing and keeps things
simple for a solo maintainer.

```bash
npm run release:minor     # or release:patch
# = npm version <bump> across all packages + root, creates tag vX.Y.Z,
#   pushes with the tag -> the release workflow publishes to GH Packages.
```

The workflow authenticates with the built-in `GITHUB_TOKEN` (it has
`packages: write` for this repo), so no PAT is needed on the publish side.
Published package visibility follows this repo's visibility.

For changelogs later, adopt **Changesets**; it's overkill at two consumers today.

## Consuming from an app repo

1. Copy `consumer.npmrc.example` to `.npmrc` in the app and provide `NPM_TOKEN`
   (a PAT with `read:packages`) — see that file for the GH Packages access note.
2. Install:
   ```bash
   npm i @troop10rwc/ui @troop10rwc/shared
   npm i @troop10rwc/worker-kit            # in the worker side
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

## Porting notes

`worker-kit` ships real `roleForPosition`/`requireLeader` logic plus **stubs**
for `verifyAccessJwt` and `withAuth`. Move your existing implementations from
`src/worker/auth.ts` (WebCrypto RS256) and `src/worker/roster.ts` (D1 lookup)
into them, then delete the per-app copies so both apps share one.
