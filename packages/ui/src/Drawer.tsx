import { useEffect, type ReactNode } from "react";

/* ============================================================================
   scoutpack/ui · Drawer.tsx  (Models 2 & 3 layout)
   - <OverlayHost> establishes the positioning context (the list/cards area).
   - <Drawer> slides in over it; the list stays put behind a scrim so you never
     lose your place. Closes on scrim click or Escape.
   - <SplitView> is the always-on master/detail variant (Model 2).
   ========================================================================== */

export function OverlayHost({ children }: { children: ReactNode }) {
  return <div className="t10-overlayhost">{children}</div>;
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  footer?: ReactNode;        // typically Save / Cancel buttons
  children: ReactNode;       // the edit form / detail body
}
export function Drawer({ open, onClose, title, subtitle, avatar, footer, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={"t10-scrim" + (open ? " t10-scrim--show" : "")} onClick={onClose} aria-hidden />
      <aside
        className={"t10-drawer" + (open ? " t10-drawer--open" : "")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="t10-drawer__head">
          {avatar}
          <div>
            <b style={{ fontFamily: "var(--t10-font-display)", fontSize: 15 }}>{title}</b>
            {subtitle != null && <div className="t10-sub">{subtitle}</div>}
          </div>
          <button className="t10-drawer__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="t10-drawer__body">{children}</div>
        {footer && <div className="t10-drawer__foot">{footer}</div>}
      </aside>
    </>
  );
}

/* Master/detail (Model 2). Pass the list on the left and detail on the right. */
export function SplitView({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="t10-split">
      <div className="t10-split__list">{list}</div>
      <div className="t10-split__detail">{detail}</div>
    </div>
  );
}
