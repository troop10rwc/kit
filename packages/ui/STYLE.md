# scoutpack — Back-Office Style Guide

How the internal interface looks, behaves, and stays consistent as it grows.
This is the contract: new pages compose the components in `src/ui/`, use the
tokens in `theme.css`, and follow the interaction-model decision guide below.
If something here fights the way you want to build a feature, change the guide
in the same PR — don't fork the patterns silently.

> **Scope.** This governs the authenticated back office (`/gearlist`, leader and
> scout views). It deliberately diverges from the public `troop10rwc.org`
> recruiting site. Same *identity* — Scouting palette, topographic motif — but
> the public site optimizes for warmth and conversion; the back office optimizes
> for **fast, low-error changes to long lists**.

---

## 1. Principles

1. **The list is the home.** Most work is scanning many records and changing a
   few. Optimize for density and legibility over decoration. A volunteer should
   find the row and fix it in seconds.
2. **Never lose your place.** Editing happens *in context* — in the cell, in a
   drawer over the list, or in a detail pane beside it. Avoid full-page route
   changes just to edit one field.
3. **Show the effect before the write.** Anything touching money, roster, or
   another member's data shows a preview/diff and a confirm step. This is a
   first-class pattern (Models 4 and 5), not an afterthought.
4. **Numbers are instruments.** Counts, quantities, money, dates, and IDs render
   in mono with tabular figures so columns align and diffs read cleanly.
5. **Tone, not color.** Components take semantic status tones (`ok` / `warn` /
   `alert` / `info` / `neutral`), never raw hex. Map domain state to a tone once.
6. **Role gates the affordance, not just the API.** Edit controls only render
   for leaders. The Worker still enforces it (defense in depth), but a scout
   should never see a disabled "Save" they can't use.
7. **Quiet until it matters.** Default to calm surfaces; reserve Scouting clay
   (red) for the single primary action and for destructive/attention states.

---

## 2. Setup

```ts
// src/main.tsx (entry), once, in this order:
import "@fontsource-variable/archivo";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./ui/theme.css";
```

```
npm i @fontsource-variable/archivo @fontsource-variable/hanken-grotesk @fontsource/ibm-plex-mono
```

Self-hosting fonts via `@fontsource` (rather than the Google Fonts CDN) keeps
everything same-origin behind Cloudflare Access and avoids a third-party request
on every page load. All components live under `src/ui/` and import only
`theme.css` class names — no CSS-in-JS, no UI framework, consistent with the
hand-written-CSS choice.

**Icons need no entry import.** They ship with the kit as Font Awesome (free)
inline SVGs — no webfont, no icon stylesheet, nothing to add to `main.tsx`.
Render an `<Icon>` and pull the definition from a namespaced pack:

```ts
import { Icon } from "@troop10rwc/ui";
import { faTent } from "@troop10rwc/ui/icons/solid"; // also /regular, /brands
```

The kit re-exports the free packs, so it stays your only dependency — don't
install `@fortawesome/*` yourself. See §"Icons" below for when and how to use them.

---

## 3. Design tokens

All tokens are CSS custom properties on `:root` in `theme.css`, namespaced
`--t10-*`. **Never hard-code a value that a token exists for.** If you need a new
value, add a token.

### Color

| Token | Use |
|---|---|
| `--t10-ink` / `-soft` / `-faint` | primary / secondary / tertiary text |
| `--t10-paper` | app background (warm "trail paper", not white) |
| `--t10-surface` / `-2` / `-3` | cards · recessed bars · hover wells |
| `--t10-line` / `-soft` | borders · hairline row dividers |
| `--t10-pine` / `-deep` / `-tint` | identity, nav-active, "go" / positive |
| `--t10-clay` / `-deep` / `-tint` | **primary action** + destructive accent |
| `--t10-amber*` / `--t10-blue*` | warn / info accents |
| `--t10-status-{ok,alert,warn,info,neutral}-{fg,bg}` | the only colors a status pill should use |

The whole palette is warm-neutral + pine + Scouting red. Dominant calm surfaces,
one sharp accent — do not introduce new hues per feature.

### Type

Three families, each with a job. **Do not** reach for a fourth.

| Family | Token | Role |
|---|---|---|
| Archivo (display) | `--t10-font-display` | titles, table headers, labels, button text — tight, stamped, "field-manual" |
| Hanken Grotesk (body) | `--t10-font-body` | running text, inputs, descriptions |
| IBM Plex Mono | `--t10-font-mono` | all numbers, IDs, dates, diffs, status pills |

Scale: `--t10-fs-xs … -xl` (11 → 22px). Labels use the `.t10-label` recipe
(uppercase, tracked, faint). Space scale `--t10-s1 … -s6`. Radii `--t10-r-sm/r/-lg`.

### Icons

One icon vocabulary: **Font Awesome (free)**, rendered as inline SVG by `<Icon>`.
**Use an icon whenever a glyph clarifies an action or row** — nav items, buttons,
toolbar affordances, empty states, inline status — and prefer it over a bare text
label where a recognizable mark speeds scanning. This is a deliberate default,
not decoration: the list is the home (§1), and a consistent leading glyph is one
of the cheapest ways to make a long list scannable.

```tsx
import { Icon } from "@troop10rwc/ui";
import { faTent, faPlus, faTriangleExclamation } from "@troop10rwc/ui/icons/solid";

<Icon icon={faTent} />
<Button variant="primary"><Icon icon={faPlus} /> New item</Button>
```

Rules:

- **`<Icon>` only — never an emoji or unicode glyph** (`⛺ ◧ ⌕ ◉ ⚙`). Those render
  differently on every OS and ignore the tokens; `<Icon>` is one mark everywhere.
- **Solid is the default style** (`/icons/solid`). Reach for `/icons/regular`
  (outline) only when you specifically want the lighter weight, and `/icons/brands`
  for third-party logos (GitHub, Google).
- **Tone, not color (§1.5).** Icons paint with `currentColor` and size to `1em`,
  so they inherit the surrounding text's `--t10` color and font-size for free.
  Set the *parent's* color (e.g. a `StatusPill`'s tone) — never hard-code an
  icon's fill or px size. `<Icon>` defaults to `fixedWidth` so glyphs align in
  columns and nav.
- **Decorative vs. meaningful.** An icon paired with a text label is decorative —
  pass `aria-hidden`. An icon that stands alone (an icon-only button) needs an
  accessible name on the control (`aria-label`), per §9.
- **Stay in the free set.** Don't pull in Pro packs or one-off SVGs; if a needed
  concept has no free icon, pick the closest free glyph and note it, or add a
  shared mapping rather than scattering custom SVGs.

**Shared vocabulary.** One concept, one mark — reuse these across apps so a glyph
means the same thing everywhere. Reach for the closest entry before inventing a
new association, and extend the table (in a PR) rather than diverging. All solid
(`/icons/solid`).

| Concept | Icon | Typical use |
|---|---|---|
| Youth / scouts | `faPersonHiking` | youth nav + lists |
| Adults / leaders | `faPeopleGroup` | adult nav + lists |
| Roles / access | `faUserShield` | role + permission views |
| Edit a person | `faUserPen` | set override, edit member |
| Link an account | `faLink` | Slack / account association |
| Unlink | `faLinkSlash` | break an association |
| Tokens / secrets | `faKey` | export tokens, API keys |
| Add / create | `faPlus` | "New …" / "Create …" actions |
| Revoke / disable | `faBan` | revoke token, disable access |
| Preview / scan | `faMagnifyingGlass` | dry-run, search actions |

### Motion & a11y

Transitions use `--t10-dur` + `--t10-ease`. Focus is always visible
(`--t10-ring`). `prefers-reduced-motion` disables transitions globally. Keep it.

---

## 4. The five interaction models — when to use which

Every back-office screen is a list-plus-edit problem. Pick the model that fits
the *shape of the record and the edit*, then implement it with the matching
component. Mixing models in one app is expected and good — just be consistent
**per data type**.

| # | Model | Component | Use when… | Avoid when… |
|---|---|---|---|---|
| 1 | **Ledger Grid** — edit-in-place | `DataTable` | many rows, shallow fields, you scan & tweak (closet inventory, dues, attendance). Live footer totals. | a record has depth that won't fit a row. |
| 2 | **Split View** — list + live detail | `SplitView` | each record is rich and you move between a few of them (a scout's profile, a packing list with history). | the list is huge and detail is trivial. |
| 3 | **Cards + Drawer** — edit over context | `OverlayHost` + `Drawer` | visual/identity-led browsing where quick edits shouldn't lose scroll position (members, gear photos). | dense tabular comparison is the point — use Model 1. |
| 4 | **Command-First** — ⌘K | `CommandPalette` | power users doing repetitive actions fast ("mark X retired", "jump to Y"). Always pair with an inline `preview`. | the primary audience is occasional volunteers who don't know the verbs. Offer it as an accelerator *on top of* a visible UI, never the only path. |
| 5 | **Describe & Review** — change with a diff | `ChangesetReview` | a single intent fans out into several writes across tables (member withdraws → refund + roster + waitlist), or any agent/automation-proposed change. | a one-field edit — that's Model 1/3 overkill. |

**Default for a new list page:** Model 1 (`DataTable`) for the list, Model 3
(`Drawer`) for "open this one record." Add Model 4 once the verbs stabilize.
Reserve Model 5 for batch/cross-table mutations and anything an agent proposes.

The rule tying 4 and 5 together: **a write that the user didn't make field-by-field gets a preview.** Same discipline, two surfaces.

---

## 5. Component catalog

Import from `src/ui/`. Props shown are the load-bearing ones; see each file for
the full type.

### Primitives — `primitives.tsx`

```tsx
<Button variant="primary|default|ghost|danger" size="sm|md">…</Button>
<StatusPill tone="ok|alert|warn|info|neutral">Worn</StatusPill>
<Field label="Quantity" hint="ct"><input … /></Field>
<SectionLabel>Ledger history</SectionLabel>
<Avatar name="Maya C." square pine />
<Toolbar><SearchInput/><FilterChip>Term ▾</FilterChip><ToolbarSpacer/><Button variant="primary">+ New</Button></Toolbar>
<EmptyState>No items in this closet yet.</EmptyState>
```

There is **one** primary button per view. Destructive actions use
`variant="danger"`. Map every domain status to a tone in one place, e.g.:

```ts
const conditionTone = { good: "ok", worn: "warn", retire: "alert", onloan: "info" } as const;
```

### `Icon` — the icon primitive — `Icon.tsx`

A thin wrapper over Font Awesome's free SVG renderer. It's the only way icons
enter the system (see §3 → Icons). Definitions come from the namespaced packs;
the kit re-exports them so you take no `@fortawesome/*` dependency directly.

```tsx
import { Icon } from "@troop10rwc/ui";
import { faTent, faTrash } from "@troop10rwc/ui/icons/solid";

<Icon icon={faTent} aria-hidden />                 {/* decorative, beside a label */}
<button className="t10-btn" aria-label="Retire"><Icon icon={faTrash} /></button>
```

`fixedWidth` is on by default; `currentColor` + `1em` sizing mean it inherits
color and scale from context — don't pass a hex fill or px size. For layered or
animated icons, the underlying `FontAwesomeIcon` is re-exported from the kit too.

### `DataTable` — Model 1 (the workhorse)

Generic, column-driven, edit-in-place, optional selection + sticky footer.
The parent owns the data and applies edits (optimistic, or after the API call).

```tsx
<DataTable
  rows={items}
  rowKey={(i) => i.id}
  canEdit={isLeader}                       // gate edit affordances on role
  onCellCommit={(id, col, value) => patchItem(id, { [col]: value })}
  selectable
  selection={sel} onSelectionChange={setSel}
  bulkActions={(ids) => <Button variant="ghost">Assign to trip…</Button>}
  columns={[
    { key: "name", header: "Item", editor: "text", value: (i) => i.name },
    { key: "qty",  header: "Qty",  align: "right", editor: "number", value: (i) => i.qty,
      render: (i) => <span className="t10-num">{i.qty}</span> },
    { key: "condition", header: "Condition", editor: "status",
      value: (i) => i.condition,
      options: [
        { value: "good",   label: "Good",   tone: "ok" },
        { value: "worn",   label: "Worn",   tone: "warn" },
        { value: "retire", label: "Retire", tone: "alert" },
      ],
      render: (i) => statusCell(label(i.condition), conditionTone[i.condition]) },
  ]}
  footer={<>
    <DataTable.Stat label="Items" value={items.length} />
    <DataTable.Stat label="Needs attention" value={worn} alert={worn > 0} />
  </>}
/>
```

Rules: read-only columns omit `editor`. Right-align and mono-render all numbers.
Keep the footer to running aggregates that recompute as cells change.

### `Drawer` / `SplitView` — Models 2 & 3 — `Drawer.tsx`

```tsx
<OverlayHost>
  <div className="t10-cardgrid">{cards}</div>
  <Drawer open={!!sel} onClose={() => setSel(null)}
    avatar={<Avatar name={sel?.name ?? ""} square pine />}
    title={sel?.name} subtitle={`${count} entries`}
    footer={<>
      <Button variant="primary" style={{ flex: 1 }} onClick={save}>Save changes</Button>
      <Button onClick={() => setSel(null)}>Cancel</Button>
    </>}>
    {/* edit form — list stays put behind the scrim */}
  </Drawer>
</OverlayHost>
```

`SplitView` is the always-open variant: `<SplitView list={…} detail={…} />`.
Drawer closes on Escape and scrim click; both are wired for you.

`Drawer` is built on [Radix](https://www.radix-ui.com/)'s **headless** `Dialog`
— Radix owns only the *behavior* (focus trap, focus restore on close, Escape +
scrim dismissal, dialog ARIA), while every pixel still comes from our `t10-*`
classes. It renders without a portal so the dialog overlays the `OverlayHost`
region (not the whole viewport), preserving the Model 3 "edit in context" feel.
You author the body/footer exactly as before; the API is unchanged.

### `CommandPalette` — Model 4 — `CommandPalette.tsx`

Mount once near the root; the `useCommandPalette()` hook wires ⌘K/Ctrl-K.

```tsx
const { open, closePalette } = useCommandPalette();
<CommandPalette open={open} onClose={closePalette} commands={[
  { id: "retire", label: "Retire selected gear", hint: "→ condition: Retire", meta: "run",
    preview: <DiffLine label="3 items" was="Worn" now="Retire" />,
    run: () => bulkSetCondition(sel, "retire") },
  { id: "jump-maya", label: "Open Maya C.", hint: "→ member record", meta: "jump",
    run: () => navigate("roster", "maya") },
]} />
```

Every *mutating* command should carry a `preview`. Navigation commands don't.

### `ChangesetReview` — Model 5 — `ChangesetReview.tsx`

Render a proposed batch; user Applies or Discards. Have the server accept the
**same changeset shape** and run it in one D1 transaction — the preview and the
write are one description, which is also exactly what you want when an agent
proposes the change.

```tsx
<ChangesetReview
  warning="touches gear + two packing lists"
  changes={[
    { id: "1", title: "Tent #14", field: "status", was: "In closet", now: "Assigned · Olympic 2026" },
    { id: "2", title: "Olympic 2026 list", note: "Tent #14 added — group gear now complete." },
  ]}
  applied={applied}
  onApply={commit} onDiscard={() => setProposal(null)}
/>
```

### `BackOfficeTopNav` — cross-app product switcher — `BackOfficeTopNav.tsx`

The bar shared across the *whole* back office (Expenses · Gearlist · …), rendered
identically by every app. The app list lives **here** in the kit
(`BACK_OFFICE_APPS`) — the single source of truth. A consuming app passes only its
own `active` id, the signed-in `user`, and the Access `logoutUrl`; it never
hand-maintains the list. Adding a back-office app is a one-line edit to
`BACK_OFFICE_APPS` plus a kit release. Apps mount same-origin under `/manage`, so
the entries are plain in-page links (no router dependency).

```tsx
<BackOfficeTopNav
  active="gearlist"                       // matches a BACK_OFFICE_APPS id
  user={{ name: identity.name, role: positionLabel }}
  logoutUrl={accessLogoutUrl}
/>
```

This is the product-switcher chrome *above* the app; `AppShell` (§6) is the
per-app frame (brand + sidebar + headstrip) that sits beneath it.

---

## 6. Layout & page skeleton

Every page lives inside `AppShell` (topbar + sidebar + headstrip). You own the
nav as data: groups, order, membership, nesting, brand, and visibility. Give each
item an `href` so it renders as a real link (middle-click, open-in-new-tab, native
a11y); set `active` (or an `isActive` predicate for route-prefix matching) to mark
the current one. Compute visibility yourself with `hidden` — e.g. derive leader
status from the `member_roles` role, *not* the raw OIDC claim (see
`src/worker/roster.ts`), and pass `hidden={!isLeader}`.

```tsx
import { Icon } from "@troop10rwc/ui";
import { faTent, faClipboardList, faTableList, faUsers, faGear, faPlus } from "@troop10rwc/ui/icons/solid";

<AppShell
  active={page}
  brand={{ badge: "T10", title: "Gearlist", subtitle: "Back Office · RWC" }}
  user={{ name: identity.name, role: positionLabel }}
  title="Closet — Troop Gear" subtitle={`${items.length} items`}
  actions={<Button variant="primary"><Icon icon={faPlus} /> New item</Button>}
  nav={[
    { label: "Operations", items: [
      { id: "closet",    label: "Closet",    icon: <Icon icon={faTent} />, href: "#/closet", count: items.length },
      { id: "lists",     label: "Packing Lists", icon: <Icon icon={faClipboardList} />, href: "#/",
        children: [{ id: "event:626", label: "Summer Camp", href: "#/event/626" }] },
      { id: "templates", label: "Templates", icon: <Icon icon={faTableList} />, href: "#/templates" },
    ]},
    { label: "Roster", items: [
      { id: "roster",   label: "Roster",   icon: <Icon icon={faUsers} />, href: "#/roster",   hidden: !isLeader },
      { id: "settings", label: "Settings", icon: <Icon icon={faGear} />, href: "#/settings", hidden: !isLeader },
    ]},
  ]}
>
  {/* page content: a DataTable, a SplitView, cards + Drawer, … */}
</AppShell>
```

A flat `nav={[…]}` (no groups) is still accepted: items are bucketed into the
historical Operations/Roster id groups and `leaderOnly`/`isLeader` still filter
them. Prefer the grouped form above for anything new.

### Responsive

The back office is desktop-first, but leaders use it on phones at meetings and
on trips. There is **one breakpoint — phones, `≤760px`** — and we keep it that
way on purpose: resist adding a tablet tier until a real screen proves it needs
one, since every tier is another place layouts can drift.

The frame is responsive out of the box (handled in `theme.css`, no per-page
work): the `AppShell` grid stacks to one column and the sidebar becomes a
horizontal, swipeable nav strip (group eyebrows hide); `SplitView` stacks
list-over-detail; `Drawer` goes full-bleed. `DataTable` keeps its own horizontal
scroll, so wide ledgers stay usable.

When you build a **new multi-column layout**, don't hand-roll a media query —
add `.t10-stack-sm` to the grid container and it collapses to a single column at
the breakpoint for free:

```tsx
<div className="t10-stack-sm" style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
  {/* two columns on desktop, stacked on phones */}
</div>
```

The 760px value lives in the `@media` queries in `theme.css` (CSS can't read a
custom property inside a media condition); if you ever move the tier, change it
there and update this section in the same PR.

---

## 7. Editing & state conventions

- **Optimistic by default, reconcile on response.** `onCellCommit` and Drawer
  `save` should update local state immediately, fire the `/api/*` call, and roll
  back + surface an error on failure. Keep the optimistic helper in one place.
- **Batch + cross-table mutations go through a changeset.** Don't scatter three
  `fetch`es across a handler; build a `Change[]`, show `ChangesetReview`, then
  POST the batch to a single transactional endpoint.
- **Money / quantity always mono + tabular.** Use `.t10-num`. Negatives get
  `.t10-amt--neg`.
- **Confirm destructive + other-member edits.** `variant="danger"` button +
  either a preview (Model 4/5) or a short confirm. Never silently hard-delete.
- **Empty, loading, error are real states.** Use `EmptyState`; don't render a
  bare empty table. (A skeleton-row variant is a fine future addition to `DataTable`.)

---

## 8. Do / Don't

**Do**
- Compose existing components; add tokens before values.
- One primary (clay) action per view.
- Right-align and mono-render every number.
- Use a Font Awesome (free) `<Icon>` wherever a glyph aids scanning, and let it
  inherit color + size from context.
- Gate edit UI on role *and* enforce on the Worker.
- Preview any write the user didn't type field-by-field.

**Don't**
- Place an emoji or unicode glyph (`⛺ ⌕ ◧ ◉`) as an icon, hard-code an icon's
  color/size, or hand-roll a one-off SVG — use `<Icon>` from the free packs.
- Introduce a *styling* framework (Tailwind, MUI, Chakra…), CSS-in-JS, or a
  fourth font. **Headless behavior** primitives (Radix, React Aria) are allowed
  — and preferred — for interaction correctness (focus trap, keyboard nav, ARIA)
  *as long as* all styling stays in `t10-*` classes/tokens. The rule is "no one
  else's CSS," not "no dependencies."
- Add new hues per feature, or use raw hex where a token exists.
- Use clay for anything but the primary/destructive action.
- Navigate to a new page just to edit one field.
- Ship a delete with no confirm or a batch write with no diff.

---

## 9. Extending the system

Adding a component? It must: (a) use only `--t10-*` tokens, (b) expose semantic
props (tones, not colors), (c) be keyboard-operable with visible focus — for
dialogs/menus/tooltips/listboxes, build on a headless primitive (Radix/React
Aria) rather than hand-rolling focus and ARIA — (d) work
under `prefers-reduced-motion`, and (e) get a row in §5 plus, if it changes the
decision space, §4. New status meaning → add a tone mapping, not a new pill color.
Any glyph it shows is a Font Awesome (free) `<Icon>` — decorative ones get
`aria-hidden`, and an icon-only control gets an `aria-label`.

*This guide and `src/ui/` are the source of truth. Treat drift as a bug.*
