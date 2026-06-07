import type { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from "react";

/* ============================================================================
   scoutpack/ui · primitives.tsx
   Low-level building blocks. All styling lives in theme.css (class names only),
   so these stay framework-free and trivially themeable.
   ========================================================================== */

/* -------------------------------------------------------------- Button --- */
type ButtonVariant = "default" | "primary" | "ghost" | "danger";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}
const variantClass: Record<ButtonVariant, string> = {
  default: "",
  primary: " t10-btn--primary",
  ghost: " t10-btn--ghost",
  danger: " t10-btn--danger",
};
export function Button({ variant = "default", size = "md", className = "", ...rest }: ButtonProps) {
  const cls = `t10-btn${variantClass[variant]}${size === "sm" ? " t10-btn--sm" : ""}${className ? " " + className : ""}`;
  return <button className={cls} {...rest} />;
}

/* ----------------------------------------------------------- StatusPill --- *
   Semantic tones, NOT raw colors. Map any domain state to a tone:
   gear "Good" -> ok, "Worn" -> warn, "Retire" -> alert, "On loan" -> info.    */
export type StatusTone = "ok" | "alert" | "warn" | "info" | "neutral";
export function StatusPill({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={`t10-pill t10-pill--${tone}`}>{children}</span>;
}

/* --------------------------------------------------------------- Field --- */
interface FieldProps {
  label: string;
  hint?: ReactNode; // small right-aligned affordance, e.g. "$" or "edit"
  children: ReactNode; // the input/select/textarea
}
export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="t10-field">
      <span className="t10-label">{label}</span>
      <span className="t10-field__box">
        {children}
        {hint != null && <span className="t10-field__hint">{hint}</span>}
      </span>
    </label>
  );
}

/* --------------------------------------------------------- SectionLabel --- */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="t10-section">{children}</div>;
}

/* -------------------------------------------------------------- Avatar --- */
export function Avatar({ name, square, pine }: { name: string; square?: boolean; pine?: boolean }) {
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={`t10-avatar${square ? " t10-avatar--square" : ""}${pine ? " t10-avatar--pine" : ""}`}>
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------- Toolbar --- */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="t10-toolbar">{children}</div>;
}
export function ToolbarSpacer() {
  return <div className="t10-toolbar__spacer" />;
}
export function FilterChip({ children }: { children: ReactNode }) {
  return <span className="t10-filterchip">{children}</span>;
}

/* ---------------------------------------------------------- SearchInput --- */
interface SearchProps extends InputHTMLAttributes<HTMLInputElement> {}
export function SearchInput({ placeholder = "Search…", ...rest }: SearchProps) {
  return (
    <div className="t10-search">
      <span aria-hidden>⌕</span>
      <input type="search" placeholder={placeholder} {...rest} />
    </div>
  );
}

/* ---------------------------------------------------------- EmptyState --- */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="t10-empty">{children}</div>;
}
