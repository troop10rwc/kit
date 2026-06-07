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

---

## 6. Layout & page skeleton

Every page lives inside `AppShell` (topbar + role-aware sidebar + headstrip).
Leader-only sections (e.g. **Roster**) carry `leaderOnly` and are filtered by
`isLeader`, which you derive from the `member_roles`-driven role — *not* the raw
OIDC claim (see `src/worker/roster.ts`).

```tsx
<AppShell
  active={page} onNavigate={setPage}
  isLeader={role === "leader"}
  user={{ name: identity.name, role: positionLabel }}
  title="Closet — Troop Gear" subtitle={`${items.length} items`}
  actions={<Button variant="primary">+ New item</Button>}
  nav={[
    { id: "closet",    label: "Closet",    icon: "⛺", count: items.length },
    { id: "lists",     label: "Packing Lists", icon: "◧" },
    { id: "templates", label: "Templates", icon: "▤" },
    { id: "trips",     label: "Trips",     icon: "▲" },
    { id: "roster",    label: "Roster",    icon: "◉", leaderOnly: true },
    { id: "settings",  label: "Settings",  icon: "⚙", leaderOnly: true },
  ]}
>
  {/* page content: a DataTable, a SplitView, cards + Drawer, … */}
</AppShell>
```

Since there's no router library, `page` is your own state; the sidebar drives it.
Keep the `id`s aligned with whatever client-side gating you already use.

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
- Gate edit UI on role *and* enforce on the Worker.
- Preview any write the user didn't type field-by-field.

**Don't**
- Introduce a UI framework, CSS-in-JS, or a fourth font.
- Add new hues per feature, or use raw hex where a token exists.
- Use clay for anything but the primary/destructive action.
- Navigate to a new page just to edit one field.
- Ship a delete with no confirm or a batch write with no diff.

---

## 9. Extending the system

Adding a component? It must: (a) use only `--t10-*` tokens, (b) expose semantic
props (tones, not colors), (c) be keyboard-operable with visible focus, (d) work
under `prefers-reduced-motion`, and (e) get a row in §5 plus, if it changes the
decision space, §4. New status meaning → add a tone mapping, not a new pill color.

*This guide and `src/ui/` are the source of truth. Treat drift as a bug.*
