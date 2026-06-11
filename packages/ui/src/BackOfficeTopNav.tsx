/* ============================================================================
   @troop10rwc/ui · BackOfficeTopNav.tsx
   The cross-app product switcher shared across the whole Troop 10 back office.
   Every back-office app renders this identically: brand, the list of sibling
   apps (Expenses · Gearlist · …), the signed-in user, and sign-out.

   The app list lives HERE — this is the single source of truth. Adding a new
   back-office app is a one-line edit to BACK_OFFICE_APPS plus a kit release;
   consuming apps pass only their own `active` id and never hand-maintain the
   list. Each app is mounted same-origin under its own base path beneath
   /manage, so these are plain in-page links (no router dependency).
   ========================================================================== */

export interface BackOfficeApp {
  id: string;
  label: string;
  href: string;
}

/** The canonical roster of back-office apps, in nav order. Single source of
 *  truth — see the file header before editing. */
export const BACK_OFFICE_APPS: BackOfficeApp[] = [
  { id: "calendar", label: "Calendar", href: "/manage/calendar" },
  { id: "gearlist", label: "Gearlist", href: "/manage/gearlist" },
  { id: "expenses", label: "Expenses", href: "/manage/expenses" },
  { id: "roster", label: "Roster", href: "/manage/roster" },
];

interface BackOfficeTopNavProps {
  /** Which app is rendering this — matches a BACK_OFFICE_APPS id. */
  active: string;
  /** The signed-in user, from the app's own /me endpoint. */
  user: { name: string; role?: string };
  /** Cloudflare Access logout URL (the "Sign out" target). */
  logoutUrl: string;
  /** Override the app list (e.g. tests, or staged rollout). Defaults to the
   *  shared registry — apps should not normally pass this. */
  apps?: BackOfficeApp[];
}

export function BackOfficeTopNav({
  active, user, logoutUrl, apps = BACK_OFFICE_APPS,
}: BackOfficeTopNavProps) {
  const home = apps.find((a) => a.id === active) ?? apps[0];

  return (
    <header className="appnav">
      <div className="appnav__inner">
        <a className="appnav__brand" href={home?.href ?? "/manage"}>
          <span className="appnav__badge">T10</span>
          <span className="appnav__brandtext">Troop 10<small>RWC Back Office</small></span>
        </a>
        <nav className="appnav__products" aria-label="Apps">
          {apps.map((a) => (
            <a
              key={a.id}
              className={`appnav__product${a.id === active ? " appnav__product--active" : ""}`}
              aria-current={a.id === active ? "page" : undefined}
              href={a.href}
            >
              {a.label}
            </a>
          ))}
        </nav>
        <div className="appnav__spacer" />
        <span className="appnav__user">Signed in as <strong>{user.name}</strong></span>
        <a className="appnav__signout" href={logoutUrl}>Sign out</a>
      </div>
    </header>
  );
}
