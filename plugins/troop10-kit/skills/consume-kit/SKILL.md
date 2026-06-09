---
name: consume-kit
description: Prep a Troop 10 RWC app to consume @troop10rwc/kit (shared, ui, worker-kit). When invoked, it sets up GitHub Packages auth (.npmrc), installs the packages, wires the entry CSS imports, drops a kit pointer into CLAUDE.md, and registers the plugin at the repo level. Use when adding the kit to a repo, fixing a @troop10rwc install or 401/403 auth error, or wiring AppShell/auth for the first time.
---

# Consume @troop10rwc/kit

`@troop10rwc/kit` is the shared stack for Troop 10 RWC apps. Three packages, split
by runtime — **reuse them instead of redefining types, re-styling components, or
re-implementing Access auth:**

| Package | Runtime | Use for |
|---|---|---|
| `@troop10rwc/shared` | neutral | types/contracts: `Role`, `Position`, `LEADER_POSITIONS`, `Identity`, `Change`, `Changeset` |
| `@troop10rwc/ui` | React 19 (DOM) | back-office components + `theme.css` / `fonts.css` design tokens |
| `@troop10rwc/worker-kit` | Cloudflare Workers (`workerd`) | `verifyAccessJwt`, `roleForPosition`, `withAuth`, `requireLeader` |

## When invoked: prep this repo

Do these in order **in the current repo**. They're idempotent — detect and skip
anything already done, and **report what changed; leave committing to the user**
(if the repo is on its default branch, create a branch before committing).

1. **Detect the package manager** from the lockfile: `pnpm-lock.yaml` → pnpm,
   `package-lock.json` → npm, `yarn.lock` → yarn. Use it for every command below.
   Detect whether there's a Worker (`wrangler.*`, `src/worker/`) — only then
   install `worker-kit`.

2. **Create `.npmrc`** at the repo root if absent (don't overwrite an existing
   token line):
   ```ini
   @troop10rwc:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```
   The packages are public, but GitHub Packages' npm registry has **no anonymous
   access** — a token is always required:
   - **CI:** `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (works from any repo).
   - **Local:** any classic PAT exported as `NPM_TOKEN` or in your user `~/.npmrc`.
     For a one-off install: `NPM_TOKEN=$(gh auth token) <pm> install`.
   - A `401/403 … does not match expected scopes` means the token is missing —
     it is **not** a visibility problem.

3. **Install** (use the detected PM; `add` for pnpm/yarn, `i` for npm):
   ```bash
   <pm> add @troop10rwc/ui @troop10rwc/shared      # client
   <pm> add @troop10rwc/worker-kit                  # only if there's a Worker
   ```
   React 19 is a **peer** dep of `ui`; the app's own React satisfies it.

4. **Wire the UI** — in the client entry (e.g. `src/main.tsx`, `src/client/main.tsx`),
   add these **before** other imports if not already present (order matters):
   ```ts
   import "@troop10rwc/ui/fonts.css";   // fonts FIRST
   import "@troop10rwc/ui/theme.css";   // then tokens
   ```
   Then import components from `@troop10rwc/ui` as needed. Read the design contract
   at `node_modules/@troop10rwc/ui/STYLE.md` before building pages (or use the
   `backoffice-style` skill).

5. **Make the repo kit-aware** — append the pointer block from the kit's
   `docs/CLAUDE.snippet.md` to this repo's `CLAUDE.md` (skip if a `@troop10rwc/kit`
   section already exists). Don't copy the kit's `STACK.md` in — link to it; the
   repo keeps its own app docs.

6. **Register the plugin at the repo level** — merge into `.claude/settings.json`
   so the skills auto-load for anyone who trusts the repo (don't clobber existing keys):
   ```json
   {
     "extraKnownMarketplaces": {
       "troop10rwc": { "source": { "source": "github", "repo": "troop10rwc/kit" } }
     },
     "enabledPlugins": { "troop10-kit@troop10rwc": true }
   }
   ```

7. **Verify** — run the repo's typecheck/build (e.g. `<pm> run typecheck`) and
   confirm `@troop10rwc/*` resolves. Summarize the files changed and the install.

## Wire Worker auth (when the app has a Worker)

`worker-kit` ships real `roleForPosition` / `requireLeader`. `withAuth` resolves
the Access identity and roster role onto the Hono context:

```ts
import { withAuth, requireLeader } from "@troop10rwc/worker-kit";

app.use("*", withAuth({
  verify: { teamDomain: "troop10rwc", audience: env.ACCESS_AUD },
  lookupPosition: (email) => /* your D1 query -> Position | null */ null,
  inLeaderGroup: (jwt) => /* read LEADER_GROUP from the Access claim */ false,
  devBypass: env.DEV_AUTH_BYPASS ? { email: "dev@troop10rwc", name: "Dev" } : undefined,
}));

app.post("/api/roster", requireLeader(), handler);
```

Handlers then read `c.var.identity` and `c.var.role`.

**Important:** `verifyAccessJwt` is **implemented** in `worker-kit` (WebCrypto
RS256 against the team JWKS, validating `iss` / `aud` / `exp` / signature) — so a
new app should rely on the kit rather than keep its own copy; delete any per-app
`src/worker/auth.ts` verifier as a deliberate, separately-reviewed migration.
`teamDomain` / `audience` are env/config — never hard-code or bundle them (the
published artifact is world-downloadable). Replacing a repo's existing local
auth/types with the kit is a migration, not part of the basic prep above — do it
as its own reviewed change.

## Stay current

Point **Renovate** or **Dependabot** at `@troop10rwc/*` so kit bumps arrive as
PRs. Releases are **lockstep** — all three packages move together.

Canonical docs: https://github.com/troop10rwc/kit/blob/main/STACK.md
