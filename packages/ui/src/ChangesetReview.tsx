import type { ReactNode } from "react";

/* ============================================================================
   scoutpack/ui · ChangesetReview.tsx  (Model 5)
   The human gate before a batch of writes hits D1. Render a structured set of
   proposed changes (before→after) and let the user Apply or Discard. Pairs well
   with a server endpoint that accepts the *same* changeset shape and executes
   it transactionally, so the UI preview and the write are one description.
   ========================================================================== */

export interface Change {
  id: string;
  title: ReactNode;
  /** Field-level change. Omit for pure additions/deletions. */
  field?: string;
  was?: ReactNode;
  now?: ReactNode;
  note?: ReactNode;          // consequence callout, e.g. "frees 1 trip spot"
}

interface ChangesetReviewProps {
  title?: string;
  changes: Change[];
  applied?: boolean;
  /** Shown when not yet applied — e.g. "touches money + roster". */
  warning?: ReactNode;
  onApply: () => void;
  onDiscard: () => void;
  applyLabel?: string;
}

export function ChangesetReview({
  title = "Proposed changeset",
  changes,
  applied = false,
  warning,
  onApply,
  onDiscard,
  applyLabel,
}: ChangesetReviewProps) {
  return (
    <div className="t10-changeset">
      <div className={"t10-changeset__head" + (applied ? " t10-changeset__head--applied" : "")}>
        <span aria-hidden>⟐</span> {title}
        <span className="t10-changeset__count">
          {changes.length} change{changes.length === 1 ? "" : "s"} · {applied ? "applied ✓" : "0 applied"}
        </span>
      </div>

      <div>
        {changes.map((c, i) => (
          <div className="t10-change" key={c.id}>
            <span className="t10-change__idx">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div className="t10-change__title">{c.title}</div>
              <div className="t10-diff">
                {c.field && <span>{c.field}</span>}
                {c.was != null && <span className="t10-diff__was">{c.was}</span>}
                {c.was != null && c.now != null && <span style={{ color: "var(--t10-ink-faint)" }}>→</span>}
                {c.now != null && <span className="t10-diff__now">{c.now}</span>}
              </div>
              {c.note != null && <div className="t10-change__note">{c.note}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="t10-changeset__foot">
        {applied ? (
          <span className="t10-changeset__warn" style={{ color: "var(--t10-pine-deep)" }}>
            ✓ Applied — undo available briefly
          </span>
        ) : (
          <>
            {warning && <span className="t10-changeset__warn">⚠ {warning}</span>}
            <button className="t10-btn t10-btn--primary" onClick={onApply}>
              {applyLabel ?? `Apply ${changes.length} change${changes.length === 1 ? "" : "s"}`}
            </button>
            <button className="t10-btn" onClick={onDiscard}>Discard</button>
          </>
        )}
      </div>
    </div>
  );
}
