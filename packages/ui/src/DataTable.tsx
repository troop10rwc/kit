import { useState, type ReactNode, type KeyboardEvent } from "react";
import { StatusPill, type StatusTone } from "./primitives";

/* ============================================================================
   scoutpack/ui · DataTable.tsx
   Model 1 — the workhorse. Dense, edit-in-place, optional selection + footer.
   Generic over the row type T. Edits are reported via onCellCommit; the parent
   owns the data (and decides whether to update optimistically or after the API
   round-trip). Edit affordances are gated behind `canEdit` (your leader role).
   ========================================================================== */

export interface Column<T> {
  key: string;                       // identifier passed back on edit
  header: string;
  align?: "left" | "right";
  width?: string;
  /** Display renderer. Default: String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Make this cell editable. Omit for read-only columns. */
  editor?: "text" | "number" | "select" | "status";
  /** Current editable value extractor (string|number). Required if `editor` set. */
  value?: (row: T) => string | number;
  /** Options for select/status editors. For status, include a tone per option. */
  options?: { value: string; label: string; tone?: StatusTone }[];
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  canEdit?: boolean;
  /** Fired when an editable cell is committed. Parent applies the change. */
  onCellCommit?: (rowKey: string, columnKey: string, value: string | number) => void;
  /** Enable left checkbox column + bulk actions slot. */
  selectable?: boolean;
  selection?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Rendered above the table when selection is non-empty. */
  bulkActions?: (selected: string[]) => ReactNode;
  /** Sticky footer — typically <Stat/> tiles (see DataTable.Stat). */
  footer?: ReactNode;
  emptyLabel?: string;
}

interface EditingCell { rowKey: string; columnKey: string; }

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns, rows, rowKey, canEdit = false, onCellCommit,
    selectable, selection = [], onSelectionChange, bulkActions, footer, emptyLabel = "Nothing here yet.",
  } = props;

  const [editing, setEditing] = useState<EditingCell | null>(null);

  const toggleRow = (k: string) => {
    const next = selection.includes(k) ? selection.filter((x) => x !== k) : [...selection, k];
    onSelectionChange?.(next);
  };
  const toggleAll = (checked: boolean) =>
    onSelectionChange?.(checked ? rows.map(rowKey) : []);

  const commit = (col: Column<T>, k: string, raw: string) => {
    const v = col.editor === "number" ? Number(raw) || 0 : raw;
    onCellCommit?.(k, col.key, v);
    setEditing(null);
  };

  const onKey = (e: KeyboardEvent, col: Column<T>, k: string) => {
    if (e.key === "Enter") commit(col, k, (e.target as HTMLInputElement).value);
    if (e.key === "Escape") setEditing(null);
  };

  return (
    <>
      {selectable && selection.length > 0 && (
        <div className="t10-bulkbar">
          <b className="t10-mono">{selection.length} selected</b>
          {bulkActions?.(selection)}
        </div>
      )}

      <div style={{ overflow: "auto" }}>
        <table className="t10-table">
          <thead>
            <tr>
              {selectable && (
                <th className="t10-table__tick">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && selection.length === rows.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={c.align === "right" ? "is-right" : ""} style={c.width ? { width: c.width } : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)}><div className="t10-empty">{emptyLabel}</div></td></tr>
            )}
            {rows.map((row) => {
              const k = rowKey(row);
              const selected = selection.includes(k);
              return (
                <tr key={k} data-selected={selected}>
                  {selectable && (
                    <td className="t10-table__tick">
                      <input type="checkbox" aria-label="Select row" checked={selected} onChange={() => toggleRow(k)} />
                    </td>
                  )}
                  {columns.map((col) => {
                    const right = col.align === "right";
                    const isEditing = editing?.rowKey === k && editing.columnKey === col.key;
                    const canEditCell = canEdit && !!col.editor;
                    const display = col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "");

                    return (
                      <td key={col.key} className={right ? "is-right" : ""}>
                        <div
                          className={
                            "t10-cell" +
                            (right ? " is-right" : "") +
                            (canEditCell ? " t10-cell--editable" : "") +
                            (isEditing ? " t10-cell--editing" : "")
                          }
                          onClick={() => canEditCell && !isEditing && setEditing({ rowKey: k, columnKey: col.key })}
                        >
                          {isEditing ? (
                            col.editor === "select" || col.editor === "status" ? (
                              <select
                                autoFocus
                                defaultValue={String(col.value?.(row) ?? "")}
                                onBlur={(e) => commit(col, k, e.target.value)}
                                onChange={(e) => commit(col, k, e.target.value)}
                              >
                                {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                type={col.editor === "number" ? "number" : "text"}
                                defaultValue={String(col.value?.(row) ?? "")}
                                onBlur={(e) => commit(col, k, e.target.value)}
                                onKeyDown={(e) => onKey(e, col, k)}
                              />
                            )
                          ) : (
                            display
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer && <div className="t10-tablefoot">{footer}</div>}
    </>
  );
}

/* Footer stat tile — keeps the running totals consistent across pages. */
DataTable.Stat = function Stat({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div>
      <span className="t10-stat__k">{label}</span>
      <span className={"t10-stat__v" + (alert ? " t10-stat__v--alert" : "")}>{value}</span>
    </div>
  );
};

/* Convenience: render a status value as a pill inside a (read-display) cell. */
export function statusCell(label: string, tone: StatusTone) {
  return <StatusPill tone={tone}>{label}</StatusPill>;
}
