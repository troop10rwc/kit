---
name: backoffice-style
description: The Troop 10 RWC back-office design contract — the five interaction models, --t10-* tokens, and the @troop10rwc/ui component catalog. Use when building or reviewing any authenticated back-office page or component (lists, drawers, command palette, changeset review) so it stays on-style.
---

# Troop 10 RWC back-office style

The design contract for the authenticated back office (built on `@troop10rwc/ui`).
**Full source of truth:** `node_modules/@troop10rwc/ui/STYLE.md` plus the package's
`theme.css`. Read STYLE.md before building; treat drift from it as a bug. This
skill is the decision guide.

## Principles

- **The list is the home** — optimize for density/legibility; find the row and fix
  it in seconds. Avoid decoration.
- **Never lose your place** — edit *in context* (in the cell, a drawer over the
  list, or a detail pane), not via a full-page route change to edit one field.
- **Show the effect before the write** — anything touching money, roster, or
  another member's data shows a preview/diff + confirm (Models 4 & 5).
- **Numbers are instruments** — counts, money, dates, IDs render in mono with
  tabular figures (`.t10-num`; negatives `.t10-amt--neg`).
- **Tone, not color** — components take `ok | warn | alert | info | neutral`,
  never raw hex. Map each domain status to a tone once.
- **Role gates the affordance** — edit controls render only for leaders; the
  Worker still enforces it (defense in depth).
- **Quiet until it matters** — calm surfaces; reserve Scouting clay (red) for the
  single primary action and destructive/attention states.

## Tokens (`theme.css`, `--t10-*`)

Never hard-code a value a token exists for — add a token instead. Color families:
`ink/-soft/-faint` (text), `paper` (bg), `surface/-2/-3`, `line/-soft`, `pine`
(identity/positive), `clay` (primary + destructive), `amber*`/`blue*` (warn/info),
`status-{ok,alert,warn,info,neutral}-{fg,bg}` (the only colors a status pill uses).

**Three fonts only** — don't reach for a fourth: Archivo (`--t10-font-display`:
titles, headers, labels, buttons), Hanken Grotesk (`--t10-font-body`: running text,
inputs), IBM Plex Mono (`--t10-font-mono`: all numbers, IDs, dates, diffs).
Don't add per-feature hues.

## The five interaction models — pick by the shape of the record + edit

| # | Model | Component | Use when |
|---|---|---|---|
| 1 | **Ledger Grid** (edit-in-place) | `DataTable` | many rows, shallow fields, scan & tweak; live footer totals |
| 2 | **Split View** (list + live detail) | `SplitView` | each record is rich; you move between a few |
| 3 | **Cards + Drawer** (edit over context) | `OverlayHost` + `Drawer` | visual/identity-led browsing; quick edits without losing scroll |
| 4 | **Command-First** (⌘K) | `CommandPalette` (`useCommandPalette`) | power users, repetitive actions; **every mutating command carries a `preview`** |
| 5 | **Describe & Review** (diff) | `ChangesetReview` | one intent fans out into several writes across tables, or any agent/automation-proposed change |

**Default for a new list page:** Model 1 (`DataTable`) + Model 3 (`Drawer`). Add
Model 4 once the verbs stabilize. The rule tying 4 and 5: *a write the user didn't
make field-by-field gets a preview.* Model 5 uses the `Changeset` shape from
`@troop10rwc/shared`; the Worker accepts the **same shape** and applies it in one
D1 transaction, so the preview can't drift from the write.

## Components (import from `@troop10rwc/ui`)

Primitives: `Button` (`variant primary|default|ghost|danger` — **one primary per
view**; destructive = `danger`), `StatusPill` (`tone=…`), `Field`, `SectionLabel`,
`Avatar`, `Toolbar`/`SearchInput`/`FilterChip`/`ToolbarSpacer`, `EmptyState`.
Plus `DataTable`, `Drawer` / `SplitView` / `OverlayHost`, `CommandPalette`,
`ChangesetReview`, `AppShell`. Every page lives inside `AppShell` (topbar +
role-aware sidebar); leader-only nav carries `leaderOnly`, filtered by `isLeader`.

## Do / Don't

**Do:** compose existing components; add a token before a value; one clay action
per view; right-align + mono-render every number; gate edit UI on role *and*
enforce on the Worker; preview any write not typed field-by-field; render real
`EmptyState` / loading / error states.

**Don't:** introduce a UI framework, CSS-in-JS, or a fourth font; add hues per
feature or raw hex where a token exists; use clay for anything but the
primary/destructive action; navigate to a new page just to edit one field; ship a
delete with no confirm or a batch write with no diff.

When adding a component: use only `--t10-*` tokens, expose semantic tone props,
be keyboard-operable with visible focus, work under `prefers-reduced-motion`, and
add it to the STYLE.md catalog (§5) in the same PR.
