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

   Two cross-domain destinations are also wired here as the single source of
   truth (defaults below; override per env if a preview needs to):
   - The brand logo always goes to the **dashboard** — its own app on the apex
     `troop10rwc.org` domain (DASHBOARD_URL), not a per-app home.
   - The user's name links to **account management** on the member-hub at
     `id.troop10rwc.org/manage` (ACCOUNT_URL). `id.troop10rwc.org` is account
     info only; the dashboard is a separate Worker on the apex.
   ========================================================================== */

export interface BackOfficeApp {
  id: string;
  label: string;
  href: string;
}

/** The dashboard lives on the apex `troop10rwc.org` domain as its own app
 *  (a separate Worker from the member-hub). The brand logo always points here
 *  so "home" is consistent across every back-office app. */
export const DASHBOARD_URL = "https://troop10rwc.org/dashboard";

/** Account management ("Profile") lives on the member-hub Worker at
 *  `id.troop10rwc.org/manage` — Slack enrollment, passkeys/devices, profile.
 *  `id.troop10rwc.org` is account info only; it does NOT serve the dashboard. */
export const ACCOUNT_URL = "https://id.troop10rwc.org/manage";

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
  /** Logout URL (the "Sign out" target), typically on the member-hub. */
  logoutUrl: string;
  /** Override the app list (e.g. tests, or staged rollout). Defaults to the
   *  shared registry — apps should not normally pass this. */
  apps?: BackOfficeApp[];
  /** Where the brand logo points. Defaults to the apex-domain dashboard
   *  (DASHBOARD_URL); override only for previews/staging. */
  dashboardUrl?: string;
  /** Where the user's name / "Profile" links. Defaults to account management
   *  on the member-hub (ACCOUNT_URL); override only for previews/staging. */
  profileUrl?: string;
}

export function BackOfficeTopNav({
  active, user, logoutUrl, apps = BACK_OFFICE_APPS,
  dashboardUrl = DASHBOARD_URL, profileUrl = ACCOUNT_URL,
}: BackOfficeTopNavProps) {
  return (
    <header className="appnav">
      <div className="appnav__inner">
        <a className="appnav__brand" href={dashboardUrl}>
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
        <div className="appnav__user">
          <strong className="appnav__username">{user.name}</strong>
          <a className="appnav__profile" href={profileUrl}>Profile</a>
        </div>
        <a className="appnav__signout" href={logoutUrl}>Sign out</a>
      </div>
    </header>
  );
}
