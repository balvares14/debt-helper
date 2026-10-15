/**
 * Small form primitives for the planner forms.
 *
 * These exist so every field renders its own server-side validation message in
 * the same place, rather than each form inventing its own error layout.
 */

import { clsx } from "clsx";
import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";

import { Spinner } from "@/components/common/Spinner";

export function HelpTip({ title, text }: { title?: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);

  const show = () => {
    const box = root.current?.getBoundingClientRect();
    if (box) {
      const width = Math.min(224, window.innerWidth - 16);
      const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
      const below = box.bottom + 6;
      const top = below + 88 > window.innerHeight - 8 ? Math.max(8, box.top - 88) : below;
      setPos({ top, left });
    }
    setOpen(true);
  };

  const hide = () => {
    setOpen(false);
    setPinned(false);
    setPos(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || tip.current?.contains(target)) return;
      hide();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex">
      <button
        type="button"
        aria-label={title ?? "What is this?"}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (pinned) {
            hide();
            return;
          }
          setPinned(true);
          show();
        }}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!pinned) hide();
        }}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line text-[0.5625rem] font-semibold leading-none text-ink-faint hover:border-ink-faint hover:text-ink-muted"
      >
        ?
      </button>
      {open &&
        pos &&
        createPortal(
          <span
            ref={tip}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[2100] w-56 max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-surface-1 p-2 text-left shadow-elev-2"
          >
            {title && (
              <span className="block text-[0.6875rem] font-semibold text-ink">{title}</span>
            )}
            <span className="mt-0.5 block text-[0.625rem] leading-snug text-ink-muted">{text}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}

export function Field({
  label,
  hint,
  help,
  error,
  children,
  className,
  as = "label",
}: {
  label: string;
  hint?: string;
  help?: { title?: string; text: string };
  error?: string;
  children: ReactNode;
  className?: string;
  as?: "label" | "div";
}) {
  const Tag = as;
  return (
    <Tag className={clsx("flex flex-col gap-1", className)}>
      <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-ink-muted">
        {label}
        {help && <HelpTip title={help.title} text={help.text} />}
      </span>
      {children}
      {error ? (
        <span className="text-[0.625rem] leading-snug text-danger-strong">{error}</span>
      ) : (
        hint && <span className="text-[0.625rem] leading-snug text-ink-faint">{hint}</span>
      )}
    </Tag>
  );
}

const controlClasses =
  "w-full min-w-0 rounded-xs border bg-surface-1 px-2 py-1.5 text-xs text-ink outline-none focus:border-focus disabled:bg-surface-2 disabled:text-ink-faint";

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

export function BadgeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; tone?: "brand" | "danger" }>;
}) {
  return (
    <div className="inline-flex rounded-pill border border-line bg-surface-1 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        const danger = option.tone === "danger";
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              "rounded-pill px-2.5 py-0.5 text-[0.6875rem] font-semibold transition",
              active
                ? danger
                  ? "bg-danger-soft text-danger-strong"
                  : "bg-brand-soft text-brand"
                : "text-ink-faint hover:text-ink-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({
  value,
  onChange,
  disabled = false,
  title,
}: {
  value: "active" | "draft";
  onChange: (value: "active" | "draft") => void;
  disabled?: boolean;
  title?: string;
}) {
  const active = value === "active";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled && !active}
      onClick={() => {
        if (active) {
          onChange("draft");
          return;
        }
        if (!disabled) onChange("active");
      }}
      className={clsx(
        "rounded-pill border px-2.5 py-0.5 text-[0.6875rem] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-surface-2 text-ink-muted",
      )}
    >
      {active ? "Active" : "Draft"}
    </button>
  );
}

export function BadgeSelect({
  value,
  onChange,
  options,
  icon,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  icon?: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-1",
        invalid ? "border-danger bg-danger-soft" : "border-line bg-surface-2",
      )}
    >
      {icon}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-3 text-[0.6875rem] font-semibold text-ink outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormActions({
  onCancel,
  saving,
  submitLabel,
  disabled = false,
  children,
}: {
  onCancel?: () => void;
  saving: boolean;
  submitLabel: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="submit"
        disabled={saving || disabled}
        className="inline-flex min-h-[1.875rem] min-w-[4.5rem] items-center justify-center rounded-pill bg-brand px-3.5 py-1.5 text-[0.6875rem] font-semibold text-white shadow-[0_4px_12px_rgba(79,168,85,0.28)] disabled:opacity-50"
      >
        {saving ? <Spinner size={14} /> : submitLabel}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-pill border border-line bg-surface-1 px-3.5 py-1.5 text-[0.6875rem] font-medium text-ink-muted hover:bg-surface-2"
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
