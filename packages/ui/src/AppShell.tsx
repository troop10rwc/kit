import type { ReactNode } from "react";

/* ============================================================================
   @troop10rwc/ui · AppShell.tsx
   The frame every back-office page sits inside: branded topbar, sidebar nav,
   and a headstrip for the page title + optional actions. Wrap the whole tree in
   <div className="t10-app"> once (AppShell does this).

   Nav is data-driven. Prefer the grouped form — you own the group labels, order,
   membership, nesting, and visibility:

     nav={[
       { label: "Operations", items: [
         { id: "lists", label: "Upcoming", icon: "◧", href: "#/",
           children: [{ id: "event:626", label: "Summer Camp", href: "#/event/626" }] },
         { id: "closet", label: "Closet", icon: "⛺", href: "#/closet" },
       ]},
       { label: "Roster", items: [
         { id: "roster", label: "Roster", icon: "◉", href: "#/roster", hidden: !isLeader },
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
  /** Topbar brand lockup. Defaults to the scoutpack mark for back-compat. */
  brand?: BrandSpec;
  /** Legacy role gate for `leaderOnly` items in flat-`nav` mode. */
  isLeader?: boolean;
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

const DEFAULT_BRAND: BrandSpec = { badge: "T10", title: "scoutpack", subtitle: "Back Office · RWC" };

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
  nav, active, isActive, onNavigate, brand, isLeader = false, user, title, subtitle, actions, children,
}: AppShellProps) {
  const groups = toGroups(nav, isLeader);
  const b = brand ?? DEFAULT_BRAND;

  return (
    <div className="t10-app">
      <div className="t10-topbar">
        <div className="t10-brand">
          {b.badge != null && <div className="t10-brand__badge">{b.badge}</div>}
          <div>
            {b.title}
            {b.subtitle != null && (
              <small style={{ display: "block", fontFamily: "var(--t10-font-body)", fontWeight: 500, fontSize: 10, letterSpacing: ".22em", color: "#9fb6a3", textTransform: "uppercase", marginTop: -2 }}>
                {b.subtitle}
              </small>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#dfe6da" }}>
          {user && <span>{user.name}{user.role ? ` · ${user.role}` : ""}</span>}
        </div>
      </div>

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
