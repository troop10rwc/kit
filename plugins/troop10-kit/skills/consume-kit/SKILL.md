---
name: consume-kit
description: Prep a Troop 10 RWC app to consume @troop10rwc/kit (shared, ui, worker-kit). When invoked, it sets up GitHub Packages auth (.npmrc), installs the packages, wires the entry CSS imports, drops a kit pointer into CLAUDE.md, and registers the plugin at the repo level. Use when adding the kit to a repo, fixing a @troop10rwc install or 401/403 auth error, or wiring AppShell/auth for the first time.
---

# Consume @troop10rwc/kit

`@troop10rwc/kit` is the shared stack for Troop 10 RWC apps. Three packages, split
by runtime — **reuse them instead of redefining types, re-styling components, or
re-implementing session/auth middleware:**

| Package | Runtime | Use for |
|---|---|---|
| `@troop10rwc/shared` | neutral | types/contracts: `Role`, `Position`, `LEADER_POSITIONS`, `Identity`, `Change`, `Changeset` |
| `@troop10rwc/ui` | React 19 (DOM) | back-office components + `theme.css` / `fonts.css` design tokens |
| `@troop10rwc/worker-kit` | Cloudflare Workers (`workerd`) | `requireSession` + D1 session helpers, `roleForPosition`, `requireLeader` (legacy Access `verifyAccessJwt`/`withAuth` until apps migrate) |

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

Apps authenticate with **`requireSession`** — the self-hosted scheme that
replaces Cloudflare Access. Slack OIDC enrollment, passkey ceremonies, and the
`/profile` "my devices" page live in the standalone **member-hub Worker at
`id.troop10rwc.org`**; consuming apps only validate the session.
`requireSession` reads the `__Secure-` session cookie, looks the opaque token up
in the shared D1 `sessions` table (instant revocation), and attaches the identity
to the Hono context. It **fails closed** — a missing/unknown/expired token is
unauthenticated and (by default) 302-redirects to the hub's `/login`:

```ts
import { requireSession } from "@troop10rwc/worker-kit";

app.use("*", requireSession({
  db: env.DB,                               // D1 binding holding the sessions table
  authOrigin: "https://id.troop10rwc.org",  // 302 → <authOrigin>/login?redirect=<current url>
  // onUnauthenticated: "json",          // API/fetch Workers: 401 { error: "unauthorized" } instead
  // devBypass: env.DEV_AUTH_BYPASS ? { sub: "dev", name: "Dev" } : undefined,
}));
```

Handlers then read `c.var.session` — a `SessionIdentity` of `{ sub, name?, email? }`
where `sub` is the stable Slack OIDC subject. (Pass a custom `lookup` instead of
`db` to resolve tokens your own way; `d1SessionLookup(db)` is the default.)

**Roster-role gating:** `requireSession` attaches the *identity* only — it does
**not** resolve the roster `role`, so `requireLeader()` (which reads `c.var.role`)
is currently wired only by the legacy `withAuth` path. For leader-only routes
under sessions, resolve the role from the roster (D1) in your own middleware,
keyed on `c.var.session.email` — **email is the reliable roster key** — until a
session-aware role helper lands in the kit.

**Hard constraints** (easy to get wrong): the Worker must serve on
`*.troop10rwc.org` (never `*.workers.dev`), and the session cookie uses the
`__Secure-` prefix with `Domain=troop10rwc.org` so SSO works across subdomains —
`__Host-` forbids `Domain` and breaks it. The app binds the same D1 database the
hub writes sessions to.

**Migrating off Access?** The legacy `withAuth` / `verifyAccessJwt` (WebCrypto
RS256 against the team JWKS) stay exported for apps still behind Cloudflare
Access, but new work should wire `requireSession`. Swapping a repo's existing
local auth/types onto the kit is a deliberate, separately-reviewed migration —
not part of the basic prep above. Never hard-code env/config (team domain,
audience, auth origin) into the bundle — the published artifact is
world-downloadable.

## Stay current

Point **Renovate** or **Dependabot** at `@troop10rwc/*` so kit bumps arrive as
PRs. Releases are **lockstep** — all three packages move together.

Canonical docs: https://github.com/troop10rwc/kit/blob/main/STACK.md
