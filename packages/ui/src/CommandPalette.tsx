import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";

/* ============================================================================
   scoutpack/ui · CommandPalette.tsx  (Model 4)
   Keyboard-first. Mount ONCE near the app root. Opens on ⌘K / Ctrl-K (and any
   trigger that calls the imperative open()). Filter, arrow-key navigate, Enter
   to run. A command may return a `preview` (before→after) so the user sees the
   effect before committing — the same review discipline as Model 5, inline.
   ========================================================================== */

export interface Command {
  id: string;
  label: string;
  hint?: string;                 // secondary text, e.g. "→ set status Retire"
  icon?: ReactNode;
  keywords?: string;             // extra search terms
  meta?: string;                 // right-side tag, e.g. "run" | "jump"
  preview?: ReactNode;           // optional before→after block
  run: () => void;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, openPalette: () => setOpen(true), closePalette: () => setOpen(false) };
}

interface PaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
}
export function CommandPalette({ open, onClose, commands, placeholder = "Type a command…" }: PaletteProps) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) =>
      (c.label + " " + (c.hint ?? "") + " " + (c.keywords ?? "")).toLowerCase().includes(term)
    );
  }, [q, commands]);

  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => { if (idx >= filtered.length) setIdx(0); }, [filtered, idx]);

  if (!open) return null;
  const active = filtered[idx];

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && active) { active.run(); onClose(); }
  };

  return (
    <>
      <div className="t10-palette-scrim" onClick={onClose} aria-hidden />
      <div className="t10-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="t10-palette__input">
          <span aria-hidden>⌕</span>
          <input ref={inputRef} value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <span className="t10-palette__esc">esc</span>
        </div>

        <div role="listbox">
          {filtered.length === 0 && <div className="t10-empty">No matching commands.</div>}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              role="option"
              aria-selected={i === idx}
              className={"t10-cmd" + (i === idx ? " t10-cmd--active" : "")}
              onMouseEnter={() => setIdx(i)}
              onClick={() => { c.run(); onClose(); }}
            >
              <span className="t10-cmd__icon">{c.icon ?? "›"}</span>
              <span><b>{c.label}</b>{c.hint && <span style={{ color: "var(--t10-ink-faint)" }}> {c.hint}</span>}</span>
              {c.meta && <span className="t10-cmd__meta">{c.meta}</span>}
            </div>
          ))}
        </div>

        {active?.preview && (
          <div className="t10-palette__preview">
            <div className="t10-label" style={{ marginBottom: 8 }}>Preview — before you commit</div>
            {active.preview}
          </div>
        )}
      </div>
    </>
  );
}

/* Small helper to compose a before→after line inside a command preview. */
export function DiffLine({ label, was, now }: { label: ReactNode; was: ReactNode; now: ReactNode }) {
  return (
    <div className="t10-diff" style={{ padding: "3px 0" }}>
      <span>{label}</span>
      <span className="t10-diff__was">{was}</span>
      <span style={{ color: "var(--t10-ink-faint)" }}>→</span>
      <span className="t10-diff__now">{now}</span>
    </div>
  );
}
