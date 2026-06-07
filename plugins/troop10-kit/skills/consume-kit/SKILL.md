---
name: consume-kit
description: Set up and consume @troop10rwc/kit (shared, ui, worker-kit) in a Troop 10 RWC app — the GitHub Packages .npmrc/auth, the entry-point CSS import order, and wiring worker-kit Access auth. Use when adding the kit to a repo, fixing a @troop10rwc install or 401/403 auth error, or wiring AppShell/auth for the first time.
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

## 1. Registry auth (GitHub Packages)

The packages publish to **GitHub Packages** (not npmjs) and are **public** — but
GitHub Packages' npm registry has **no anonymous access**, so a token is always
required. Add `.npmrc` at the repo root:

```ini
@troop10rwc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

- **CI:** `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` — works from any repo, no
  scopes or per-repo grants needed.
- **Local:** any classic PAT exported as `NPM_TOKEN`, or placed in your user
  `~/.npmrc` (never commit a token-bearing `.npmrc`).
- A `401/403 … does not match expected scopes` means the token/`.npmrc` is
  missing — it is **not** a package-visibility problem.

pnpm reads the same `.npmrc`.

## 2. Install

```bash
pnpm add @troop10rwc/ui @troop10rwc/shared      # client
pnpm add @troop10rwc/worker-kit                  # worker side
```

React 19 is a **peer** dependency of `ui`; the app's own React satisfies it.

## 3. Wire the UI (entry point — order matters)

```ts
import "@troop10rwc/ui/fonts.css";   // fonts FIRST
import "@troop10rwc/ui/theme.css";   // then tokens
import { AppShell, DataTable, Drawer } from "@troop10rwc/ui";
```

Before building pages, read the design contract at
`node_modules/@troop10rwc/ui/STYLE.md` — or use the `backoffice-style` skill.

## 4. Wire Worker auth

`worker-kit` ships real `roleForPosition` / `requireLeader`. `withAuth` resolves
the Access identity and the roster role onto the Hono context:

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

**Important:** in the current kit, `verifyAccessJwt` is a **stub that throws** —
port the WebCrypto RS256 verification (team JWKS) from the app's
`src/worker/auth.ts` into the kit before relying on it, then delete the per-app
copy. `teamDomain` / `audience` are env/config — never hard-code or bundle them
(the published artifact is world-downloadable).

## 5. Stay current

Point **Renovate** or **Dependabot** at `@troop10rwc/*` so kit bumps arrive as
PRs. Releases are **lockstep** — all three packages move together.

Canonical docs: https://github.com/troop10rwc/kit/blob/main/STACK.md
