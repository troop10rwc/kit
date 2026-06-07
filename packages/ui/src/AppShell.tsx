import type { ReactNode } from "react";

/* ============================================================================
   scoutpack/ui · AppShell.tsx
   The frame every back-office page sits inside: branded topbar, role-aware
   sidebar nav, and a headstrip for the page title + an optional model chip.
   Wrap the whole tree in <div className="t10-app"> once (AppShell does this).
   ========================================================================== */

export interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number | string;
  /** Hide leader-only sections for non-leaders (drives off your roster role). */
  leaderOnly?: boolean;
}

interface AppShellProps {
  active: string;
  nav: NavItem[];
  onNavigate: (id: string) => void;
  isLeader?: boolean;
  user?: { name: string; role?: string };
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions in the headstrip (e.g. "+ New"). */
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  active, nav, onNavigate, isLeader = false, user, title, subtitle, actions, children,
}: AppShellProps) {
  const groups = [
    { label: "Operations", ids: ["closet", "lists", "templates", "trips"] },
    { label: "Roster", ids: ["roster", "settings"] },
  ];
  const visible = nav.filter((n) => !n.leaderOnly || isLeader);

  return (
    <div className="t10-app">
      <div className="t10-topbar">
        <div className="t10-brand">
          <div className="t10-brand__badge">T10</div>
          <div>
            scoutpack
            <small style={{ display: "block", fontFamily: "var(--t10-font-body)", fontWeight: 500, fontSize: 10, letterSpacing: ".22em", color: "#9fb6a3", textTransform: "uppercase", marginTop: -2 }}>
              Back Office · RWC
            </small>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#dfe6da" }}>
          {user && <span>{user.name}{user.role ? ` · ${user.role}` : ""}</span>}
        </div>
      </div>

      <div style={{ padding: "18px 22px 60px", maxWidth: 1240, margin: "0 auto" }}>
        <div className="t10-shell">
          <nav className="t10-sidebar" aria-label="Sections">
            {groups.map((g) => {
              const items = visible.filter((n) => g.ids.includes(n.id));
              if (items.length === 0) return null;
              return (
                <div key={g.label}>
                  <div className="t10-sidebar__group">{g.label}</div>
                  {items.map((n) => (
                    <button
                      key={n.id}
                      className={"t10-nav" + (n.id === active ? " t10-nav--active" : "")}
                      aria-current={n.id === active ? "page" : undefined}
                      onClick={() => onNavigate(n.id)}
                    >
                      {n.icon && <span aria-hidden style={{ width: 15, textAlign: "center" }}>{n.icon}</span>}
                      {n.label}
                      {n.count != null && <span className="t10-nav__count">{n.count}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
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
