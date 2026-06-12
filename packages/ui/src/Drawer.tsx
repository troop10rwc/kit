import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/* ============================================================================
   scoutpack/ui · Drawer.tsx  (Models 2 & 3 layout)
   - <OverlayHost> establishes the positioning context (the list/cards area).
   - <Drawer> slides in over it; the list stays put behind a scrim so you never
     lose your place.
   - <SplitView> is the always-on master/detail variant (Model 2).

   The Drawer is a thin skin over Radix's headless Dialog: we keep 100% of our
   own `t10-*` CSS and tokens, and Radix owns the *behavior* that's tedious and
   error-prone to hand-roll — focus trap, focus restore on close, Escape + scrim
   dismissal, and the dialog ARIA wiring. We deliberately render WITHOUT a portal
   so the dialog overlays the OverlayHost region (Model 3 "edit in context"), not
   the whole viewport. The enter/exit slide is driven by Radix Presence + the
   `[data-state]` keyframe animations in theme.css; the overlay/content mount only
   while open, so a closed drawer never leaves a scroll-lock or click-blocking
   scrim behind.
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
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Overlay className="t10-scrim" />
      <Dialog.Content
        className="t10-drawer"
        /* no body content describes the dialog; opt out of the a11y warning */
        aria-describedby={undefined}
      >
        <div className="t10-drawer__head">
          {avatar}
          <div>
            <Dialog.Title asChild>
              <b style={{ fontFamily: "var(--t10-font-display)", fontSize: 15 }}>{title}</b>
            </Dialog.Title>
            {subtitle != null && (
              <Dialog.Description asChild>
                <div className="t10-sub">{subtitle}</div>
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <button className="t10-drawer__close" aria-label="Close">×</button>
          </Dialog.Close>
        </div>
        <div className="t10-drawer__body">{children}</div>
        {footer && <div className="t10-drawer__foot">{footer}</div>}
      </Dialog.Content>
    </Dialog.Root>
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
