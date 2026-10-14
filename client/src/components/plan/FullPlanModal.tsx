/**
 * Compact full payoff list.
 *
 * Extra payments stay one row each (amounts change). Repeating card/cash
 * routing is collapsed into a date range so weekly groceries do not drown
 * the actual payoff steps.
 */

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";

import { mediumDate, monthKeyOf, monthLabel, moneyTrim, shortDate } from "@/lib/format";
import type { PlanAction, ProjectedDebt } from "@/lib/planApi";

export interface FullPlanModalProps {
  open: boolean;
  onClose: () => void;
  actions: PlanAction[];
  debts: Array<Pick<ProjectedDebt, "id" | "name" | "paidOffDate">>;
  debtFreeDate: string | null;
}

interface CompactRow {
  from: string;
  to: string;
  kind: PlanAction["kind"];
  label: string;
  amount: number;
  count: number;
  mergeKey: string;
  detail?: string;
}

function mergeKey(action: PlanAction): string {
  if (action.kind === "extra_payment") {
    // Amounts change each payday, so extras never collapse together.
    return `extra|${action.date}|${action.debtId ?? ""}|${action.amount}`;
  }
  return `${action.kind}|${action.name ?? ""}|${action.debtId ?? ""}|${action.amount}`;
}

function compactLabel(action: PlanAction): string {
  if (action.kind === "extra_payment") {
    return `Extra → ${action.debtName ?? action.name ?? "debt"}`;
  }
  if (action.kind === "route_to_card") {
    return `${action.name ?? "Charge"} → ${action.debtName ?? "card"}`;
  }
  return `${action.name ?? "Charge"} → cash`;
}

/** Collapses consecutive identical routing; extras never merge. */
export function compactActions(actions: PlanAction[]): CompactRow[] {
  const rows: CompactRow[] = [];

  for (const action of actions) {
    const key = mergeKey(action);
    const previous = rows[rows.length - 1];

    if (action.kind !== "extra_payment" && previous && previous.mergeKey === key) {
      previous.to = action.date;
      previous.count += 1;
      continue;
    }

    rows.push({
      from: action.date,
      to: action.date,
      kind: action.kind,
      label: compactLabel(action),
      amount: action.amount,
      count: 1,
      mergeKey: key,
      detail: action.kind === "extra_payment" ? action.detail : undefined,
    });
  }

  return rows;
}

function groupByMonth(rows: CompactRow[]): Array<{ month: string; rows: CompactRow[] }> {
  const groups: Array<{ month: string; rows: CompactRow[] }> = [];

  for (const row of rows) {
    const month = monthKeyOf(row.from);
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.rows.push(row);
    } else {
      groups.push({ month, rows: [row] });
    }
  }

  return groups;
}

export default function FullPlanModal({
  open,
  onClose,
  actions,
  debts,
  debtFreeDate,
}: FullPlanModalProps) {
  const [debtId, setDebtId] = useState<number | "all">("all");

  useEffect(() => {
    if (open) setDebtId("all");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const visibleDebts = useMemo(() => {
    const ids = new Set(actions.map((action) => action.debtId).filter((id): id is number => id != null));
    return debts.filter((debt) => ids.has(debt.id));
  }, [actions, debts]);

  const filtered = useMemo(
    () => (debtId === "all" ? actions : actions.filter((action) => action.debtId === debtId)),
    [actions, debtId],
  );

  const rows = useMemo(() => compactActions(filtered), [filtered]);
  const groups = useMemo(() => groupByMonth(rows), [rows]);
  const extras = rows.filter((row) => row.kind === "extra_payment").length;
  const selected = debtId === "all" ? null : debts.find((debt) => debt.id === debtId);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.28)] p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-plan-title"
        className="my-4 flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-line bg-surface-1 shadow-elev-3"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-line px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="full-plan-title" className="text-[0.8125rem] font-semibold text-ink">
                {selected
                  ? `${selected.name} through ${selected.paidOffDate ? mediumDate(selected.paidOffDate) : "the horizon"}`
                  : `Plan through ${debtFreeDate ? mediumDate(debtFreeDate) : "the horizon"}`}
              </h2>
              <p className="mt-0.5 text-[0.6875rem] text-ink-muted">
                {extras} extra payment{extras === 1 ? "" : "s"}
                {selected
                  ? selected.paidOffDate
                    ? ` until ${mediumDate(selected.paidOffDate)}`
                    : ""
                  : debtFreeDate
                    ? ` until debt-free ${mediumDate(debtFreeDate)}`
                    : " over the projection"}
                . Repeating card spend is collapsed into a range.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-xs border border-line px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-2"
            >
              Close
            </button>
          </div>

          {visibleDebts.length > 0 && (
            <div
              className="mt-2.5 flex gap-1 overflow-x-auto pb-0.5"
              role="tablist"
              aria-label="Filter by debt"
            >
              <FilterChip
                active={debtId === "all"}
                onClick={() => setDebtId("all")}
                label="All"
              />
              {visibleDebts.map((debt) => (
                <FilterChip
                  key={debt.id}
                  active={debtId === debt.id}
                  onClick={() => setDebtId(debt.id)}
                  label={debt.name}
                />
              ))}
            </div>
          )}
        </header>

        <div className="max-h-[min(70vh,36rem)] overflow-y-auto px-3 py-2">
          {groups.length === 0 ? (
            <p className="py-4 text-xs text-ink-muted">
              {selected
                ? `Nothing scheduled for ${selected.name} on this plan.`
                : "No extra payments or routed charges on this plan."}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.month} className="mb-2 last:mb-0">
                <h3 className="sticky top-0 z-10 bg-surface-1 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-faint">
                  {monthLabel(`${group.month}-01`)}
                </h3>
                <ul>
                  {group.rows.map((row, index) => (
                    <li
                      key={`${row.from}-${row.kind}-${row.label}-${index}`}
                      className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-line-soft py-1 text-[0.6875rem] last:border-b-0"
                    >
                      <span className="tabular-nums text-ink-faint">
                        {row.from === row.to
                          ? shortDate(row.from)
                          : `${shortDate(row.from)}–${shortDate(row.to)}`}
                      </span>
                      <span className="min-w-0 truncate text-ink" title={row.detail ?? row.label}>
                        <span
                          className={clsx(
                            "mr-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-pill",
                            row.kind === "extra_payment" && "bg-brand",
                            row.kind === "route_to_card" && "bg-info",
                            row.kind === "route_to_cash" && "bg-ink-faint",
                          )}
                        />
                        {row.label}
                        {row.count > 1 && (
                          <span className="text-ink-faint"> ×{row.count}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-ink">
                        {moneyTrim(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-pill border px-2.5 py-0.5 text-[0.6875rem] font-medium transition-colors",
        active
          ? "border-ink bg-ink text-surface-1"
          : "border-line bg-surface-2 text-ink-muted hover:border-ink-faint hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
