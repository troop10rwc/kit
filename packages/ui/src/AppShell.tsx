import type { ReactNode } from "react";

/* ============================================================================
   @troop10rwc/ui · AppShell.tsx
   The frame every back-office page sits inside: the shared cross-app top bar
   (passed in via `appSwitcher` — always <BackOfficeTopNav>), sidebar nav, and a
   headstrip for the page title + optional actions. Wrap the whole tree in
   <div className="t10-app"> once (AppShell does this).

   There is ONE top bar across the whole back office: BackOfficeTopNav. AppShell
   no longer ships its own standalone topbar — `appSwitcher` is required and the
   former `brand`/`user` props are deprecated no-ops (the brand lockup and signed-
   in user now live in BackOfficeTopNav). See the migration note in README.

   Nav is data-driven. Prefer the grouped form — you own the group labels, order,
   membership, nesting, and visibility. Icons are Font Awesome (free) — render an
   <Icon> from a pack definition rather than an emoji/unicode glyph:

     import { Icon } from "@troop10rwc/ui";
     import { faCalendarDays, faTent, faUsers } from "@troop10rwc/ui/icons/solid";

     nav={[
       { label: "Operations", items: [
         { id: "lists", label: "Upcoming", icon: <Icon icon={faCalendarDays} />, href: "#/",
           children: [{ id: "event:626", label: "Summer Camp", href: "#/event/626" }] },
         { id: "closet", label: "Closet", icon: <Icon icon={faTent} />, href: "#/closet" },
       ]},
       { label: "Roster", items: [
         { id: "roster", label: "Roster", icon: <Icon icon={faUsers} />, href: "#/roster", hidden: !isLeader },
       ]},
     ]}

   A flat `nav: NavItem[]` is still accepted for back-compat and is bucketed into
   the historical Operations/Roster id groups (see LEGACY_GROUPS).
   ========================================================================== */

export interface NavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: ReactNode;
  /** Render a real <a> (middle-click, open-in-new-tab, native a11y). When set,
   *  the browser performs navigation; `onNavigate` still fires for analytics. */
  href?: string;
  /** Nested sub-items, rendered indented beneath this one. */
  children?: NavItem[];
  /** Consumer-computed visibility. A hidden item and its subtree are dropped. */
  hidden?: boolean;
  /**
   * @deprecated Compute visibility yourself with `hidden`. Honored only in the
   * legacy flat-`nav` mode, filtered against `isLeader`.
   */
  leaderOnly?: boolean;
}

export interface NavGroup {
  /** Eyebrow heading. Omit for an unlabelled group. */
  label?: string;
  items: NavItem[];
}

/** @deprecated The standalone AppShell topbar is gone — the brand lockup lives
 *  in `BackOfficeTopNav`. Kept only for back-compat of the deprecated `brand`
 *  prop's type. */
export interface BrandSpec {
  badge?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
}

interface AppShellProps {
  /** Sidebar nav: grouped (preferred) or a flat list (legacy bucketing). */
  nav: NavGroup[] | NavItem[];
  /** Active item id. Used unless an `isActive` predicate is supplied. */
  active?: string;
  /** Custom active test, e.g. route-prefix matching. Falls back to id === active. */
  isActive?: (item: NavItem) => boolean;
  /** Fires on click. For `href` items the browser also navigates. */
  onNavigate?: (id: string, item: NavItem) => void;
  /** @deprecated No-op. The standalone topbar is gone; the brand lockup now
   *  lives in `BackOfficeTopNav` (its logo points at the dashboard). */
  brand?: BrandSpec;
  /** The single top bar for the whole back office — always pass
   *  `<BackOfficeTopNav active=… user=… logoutUrl=… />`. Required: AppShell no
   *  longer renders a standalone topbar of its own. */
  appSwitcher: ReactNode;
  /** Legacy role gate for `leaderOnly` items in flat-`nav` mode. */
  isLeader?: boolean;
  /** @deprecated No-op. The signed-in user is shown by `BackOfficeTopNav`
   *  (pass `user` there instead). */
  user?: { name: string; role?: string };
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions in the headstrip (e.g. "+ New"). */
  actions?: ReactNode;
  children: ReactNode;
}

// Historical id buckets, applied only when a consumer passes a flat NavItem[].
const LEGACY_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Operations", ids: ["closet", "lists", "templates", "trips"] },
  { label: "Roster", ids: ["roster", "settings"] },
];

function isGrouped(nav: NavGroup[] | NavItem[]): nav is NavGroup[] {
  return Array.isArray((nav as NavGroup[])[0]?.items);
}

// Drop hidden / leader-gated items, recursing into children.
function prune(items: NavItem[], isLeader: boolean): NavItem[] {
  return items
    .filter((n) => !n.hidden && (!n.leaderOnly || isLeader))
    .map((n) => (n.children ? { ...n, children: prune(n.children, isLeader) } : n));
}

function toGroups(nav: NavGroup[] | NavItem[], isLeader: boolean): NavGroup[] {
  if (isGrouped(nav)) {
    return nav
      .map((g) => ({ label: g.label, items: prune(g.items, isLeader) }))
      .filter((g) => g.items.length > 0);
  }
  const flat = prune(nav, isLeader);
  return LEGACY_GROUPS
    .map((g) => ({ label: g.label, items: flat.filter((n) => g.ids.includes(n.id)) }))
    .filter((g) => g.items.length > 0);
}

function NavNode({
  item, depth, active, isActive, onNavigate,
}: {
  item: NavItem;
  depth: number;
  active?: string;
  isActive?: (item: NavItem) => boolean;
  onNavigate?: (id: string, item: NavItem) => void;
}) {
  const on = isActive ? isActive(item) : item.id === active;
  const cls = "t10-nav" + (on ? " t10-nav--active" : "") + (depth ? " t10-nav--child" : "");
  const style = depth ? { paddingLeft: 10 + depth * 16 } : undefined;
  const inner = (
    <>
      {item.icon && <span aria-hidden style={{ width: 15, textAlign: "center" }}>{item.icon}</span>}
      {item.label}
      {item.count != null && <span className="t10-nav__count">{item.count}</span>}
    </>
  );
  return (
    <>
      {item.href ? (
        <a
          className={cls}
          style={style}
          href={item.href}
          aria-current={on ? "page" : undefined}
          onClick={() => onNavigate?.(item.id, item)}
        >
          {inner}
        </a>
      ) : (
        <button
          className={cls}
          style={style}
          aria-current={on ? "page" : undefined}
          onClick={() => onNavigate?.(item.id, item)}
        >
          {inner}
        </button>
      )}
      {item.children?.map((c) => (
        <NavNode
          key={c.id}
          item={c}
          depth={depth + 1}
          active={active}
          isActive={isActive}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

export function AppShell({
  nav, active, isActive, onNavigate, appSwitcher, isLeader = false, title, subtitle, actions, children,
}: AppShellProps) {
  const groups = toGroups(nav, isLeader);

  return (
    <div className="t10-app">
      {appSwitcher}

      <div className="t10-shellwrap">
        <div className="t10-shell">
          <nav className="t10-sidebar" aria-label="Sections">
            {groups.map((g, i) => (
              <div key={g.label ?? i}>
                {g.label && <div className="t10-sidebar__group">{g.label}</div>}
                {g.items.map((n) => (
                  <NavNode
                    key={n.id}
                    item={n}
                    depth={0}
                    active={active}
                    isActive={isActive}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))}
          </nav>

          <section className="t10-main">
            <div className="t10-headstrip">
              <div>
                <h2 className="t10-h2">{title}</h2>
                {subtitle != null && <div className="t10-sub">{subtitle}</div>}
              </div>
              {actions && <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>{actions}</div>}
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
