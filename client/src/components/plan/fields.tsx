/**
 * Small form primitives for the planner forms.
 *
 * These exist so every field renders its own server-side validation message in
 * the same place, rather than each form inventing its own error layout.
 */

import { clsx } from "clsx";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("flex flex-col gap-1", className)}>
      <span className="text-[0.6875rem] font-medium text-ink-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-[0.625rem] leading-snug text-danger-strong">{error}</span>
      ) : (
        hint && <span className="text-[0.625rem] leading-snug text-ink-faint">{hint}</span>
      )}
    </label>
  );
}

const controlClasses =
  "w-full rounded-xs border bg-surface-1 px-2 py-1.5 text-xs text-ink outline-none focus:border-focus disabled:bg-surface-2 disabled:text-ink-faint";

export function TextInput({
  invalid = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={clsx(controlClasses, invalid ? "border-danger" : "border-line", className)}
    />
  );
}

/** Money and rate inputs: right-aligned digits, and no scroll-wheel surprises. */
export function NumberInput({
  invalid = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      onWheel={(event) => event.currentTarget.blur()}
      {...props}
      className={clsx(
        controlClasses,
        "tabular-nums",
        invalid ? "border-danger" : "border-line",
        className,
      )}
    />
  );
}

export function Select({
  invalid = false,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      className={clsx(controlClasses, invalid ? "border-danger" : "border-line", className)}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--ink)]"
      />
      <span className="flex flex-col">
        <span className="text-[0.6875rem] font-medium text-ink">{label}</span>
        {hint && <span className="text-[0.625rem] leading-snug text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

export function FormActions({
  onCancel,
  saving,
  submitLabel,
  children,
}: {
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="submit"
        disabled={saving}
        className="rounded-xs bg-ink px-3 py-1.5 text-[0.6875rem] font-medium text-surface-1 disabled:opacity-50"
      >
        {saving ? "Saving…" : submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xs border border-line bg-surface-1 px-3 py-1.5 text-[0.6875rem] font-medium text-ink-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      )}
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[0.8125rem] font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-0.5 max-w-prose text-[0.6875rem] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
