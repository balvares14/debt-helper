/**
 * What happens on the selected day, and why.
 *
 * Days on or before today can be confirmed, skipped, or given a different
 * amount. The next plan uses those facts instead of guessing.
 */

import { clsx } from "clsx";
import { useState, type FormEvent } from "react";

import { usePlan } from "@/contexts/PlanContext";
import { longDate, money, moneyTrim, percent } from "@/lib/format";
import {
  clearDayActual,
  saveDayActual,
  type DayItem,
  type DayItemKind,
  type ProjectedDay,
  type ReviewStatus,
} from "@/lib/planApi";

export interface DayDetailProps {
  date: string;
  day: ProjectedDay | undefined;
  cashFloor: number;
  isToday: boolean;
}

const KIND_ORDER: DayItemKind[] = [
  "gain",
  "charge",
  "required_payment",
  "extra_payment",
  "fee",
  "interest",
  "back_interest",
];

const KIND_LABELS: Record<DayItemKind, string> = {
  gain: "Money in",
  charge: "Spending",
  required_payment: "Required payments",
  extra_payment: "Extra payoff",
  fee: "Fees",
  interest: "Interest charged",
  back_interest: "Deferred interest charged",
};

export default function DayDetail({ date, day, cashFloor, isToday }: DayDetailProps) {
  const { today } = usePlan();
  const canReview = date <= today;

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: (day?.items ?? []).filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-3">
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[0.8125rem] font-semibold text-ink">{longDate(date)}</h2>
          {isToday && (
            <span className="rounded-pill bg-ink px-2 py-0.5 text-[0.625rem] font-medium text-surface-1">
              Today
            </span>
          )}
        </div>

        {day ? (
          <div className="mt-2 flex flex-col gap-1">
            <BalanceRow label="Started with" value={day.startCash} />
            <BalanceRow
              label="Left at end of day"
              value={day.endCash}
              emphasis
              tone={day.negative ? "danger" : day.belowFloor && cashFloor > 0 ? "warning" : "neutral"}
            />
            {day.net !== 0 && (
              <p className="text-[0.6875rem] text-ink-faint">
                Net change {day.net > 0 ? "+" : ""}
                {money(day.net)} across the day.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">
            This day is outside the projected range.
          </p>
        )}
      </header>

      {canReview && day && (
        <p className="text-[0.6875rem] leading-relaxed text-ink-faint">
          Mark what actually happened. Skipped extras stay off the next plan instead of
          being sent to another debt.
        </p>
      )}

      {day?.negative && (
        <p className="rounded-xs border border-danger bg-danger-soft px-2.5 py-2 text-[0.6875rem] leading-relaxed text-danger-strong">
          The account ends this day {money(Math.abs(day.endCash))} overdrawn. Required bills and
          minimum payments already use every dollar, so no extra payoff is scheduled — something
          has to move.
        </p>
      )}

      {day && !day.negative && day.belowFloor && cashFloor > 0 && (
        <p className="rounded-xs border border-warning bg-warning-soft px-2.5 py-2 text-[0.6875rem] leading-relaxed text-warning-strong">
          Cash stays positive but dips under your {money(cashFloor, { cents: false })} floor, so
          no extra payoff happens today.
        </p>
      )}

      {groups.length === 0 && day && (
        <p className="text-xs text-ink-muted">Nothing scheduled. The balance just carries over.</p>
      )}

      {groups.map((group) => (
        <section key={group.kind} className="flex flex-col gap-1.5">
          <h3 className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-faint">
            {KIND_LABELS[group.kind]}
          </h3>
          {group.items.map((item, index) => (
            <ItemRow
              key={item.itemKey || `${group.kind}-${index}`}
              item={item}
              date={date}
              canReview={canReview}
              isHistory={!isToday && date < today}
            />
          ))}
        </section>
      ))}
    </aside>
  );
}

function BalanceRow({
  label,
  value,
  emphasis = false,
  tone = "neutral",
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[0.6875rem] text-ink-muted">{label}</span>
      <span
        className={clsx(
          "tabular-nums",
          emphasis ? "text-[0.9375rem] font-semibold" : "text-xs",
          tone === "danger"
            ? "text-danger-strong"
            : tone === "warning"
              ? "text-warning-strong"
              : "text-ink",
        )}
      >
        {money(value)}
      </span>
    </div>
  );
}

/** Colour and sign follow the direction money actually moves. */
function ItemRow({
  item,
  date,
  canReview,
  isHistory,
}: {
  item: DayItem;
  date: string;
  canReview: boolean;
  isHistory: boolean;
}) {
  const isIncome = item.kind === "gain";
  const isCardSpend = item.kind === "charge" && item.method === "card";
  const affectsCash = !isCardSpend && item.kind !== "interest" && item.kind !== "back_interest" && item.kind !== "fee";
  const proposed = isHistory && item.reviewable && !item.review
    && (item.kind === "extra_payment" || item.kind === "required_payment");
  const displayAmount = item.review === "skipped" || proposed
    ? (item.plannedAmount ?? item.amount)
    : item.amount;
  const sign = isIncome ? "+" : affectsCash ? "−" : "";

  return (
    <div
      className={clsx(
        "rounded-xs border px-2.5 py-1.5",
        item.review === "skipped"
          ? "border-line bg-surface-1 opacity-70"
          : item.review === "modified"
            ? "border-brand bg-brand-soft/40"
            : item.review === "confirmed"
              ? "border-line-soft bg-surface-2"
              : "border-line-soft bg-surface-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink">{item.name}</span>
        <span
          className={clsx(
            "shrink-0 text-xs font-semibold tabular-nums",
            item.review === "skipped" || proposed
              ? "text-ink-faint line-through"
              : isIncome
                ? "text-success-strong"
                : isCardSpend
                  ? "text-info-strong"
                  : "text-ink",
          )}
        >
          {sign}
          {moneyTrim(displayAmount)}
        </span>
      </div>

      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.625rem] text-ink-faint">
        {item.kind === "charge" && (
          <Tag tone={isCardSpend ? "info" : "neutral"}>
            {isCardSpend ? `On ${item.debtName}` : "From cash"}
          </Tag>
        )}
        {item.kind === "extra_payment" && <Tag tone="brand">Extra</Tag>}
        {item.pinned && <Tag tone="neutral">Pinned</Tag>}
        {item.optimized && !item.pinned && <Tag tone="neutral">Auto-routed</Tag>}
        {item.overLimit && <Tag tone="danger">Over limit</Tag>}
        {typeof item.aprPercent === "number" && item.aprPercent > 0 && (
          <Tag tone="neutral">{percent(item.aprPercent)}</Tag>
        )}
        {item.review === "confirmed" && <Tag tone="good">Done</Tag>}
        {item.review === "skipped" && <Tag tone="neutral">Did not happen</Tag>}
        {item.review === "modified" && (
          <Tag tone="brand">
            Changed from {moneyTrim(item.plannedAmount ?? item.amount)}
          </Tag>
        )}
        {proposed && <Tag tone="neutral">Not confirmed</Tag>}
      </div>

      {item.reason && (
        <p className="mt-1 text-[0.6875rem] leading-snug text-ink-muted">{item.reason}</p>
      )}

      {canReview && item.reviewable && item.itemKey && (
        <ReviewBar item={item} date={date} />
      )}
    </div>
  );
}

function ReviewBar({ item, date }: { item: DayItem; date: string }) {
  const { save, saving } = usePlan();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.amount || item.plannedAmount || ""));

  const submit = async (status: ReviewStatus, nextAmount?: number) => {
    await save(
      (planWindow) =>
        saveDayActual(
          {
            date,
            itemKey: item.itemKey as string,
            status,
            amount: nextAmount ?? item.amount,
            plannedAmount: item.plannedAmount ?? item.amount,
            debtId: item.debtId ?? null,
            method: item.method ?? null,
          },
          planWindow,
        ),
      { silent: true },
    );
  };

  const clear = async () => {
    await save(
      (planWindow) => clearDayActual(date, item.itemKey as string, planWindow),
      { silent: true },
    );
  };

  const handleModify = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(String(amount).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    await submit("modified", parsed);
    setEditing(false);
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <ReviewButton
          label="Did this"
          active={item.review === "confirmed"}
          disabled={saving}
          onClick={() => void submit("confirmed", item.plannedAmount ?? item.amount)}
        />
        <ReviewButton
          label="Didn't happen"
          active={item.review === "skipped"}
          disabled={saving}
          onClick={() => void submit("skipped", 0)}
        />
        <ReviewButton
          label="Change amount"
          active={item.review === "modified" || editing}
          disabled={saving}
          onClick={() => {
            setAmount(String(item.review === "modified" ? item.amount : (item.plannedAmount ?? item.amount)));
            setEditing((open) => !open);
          }}
        />
        {item.review && (
          <ReviewButton label="Undo" disabled={saving} onClick={() => void clear()} />
        )}
      </div>

      {editing && (
        <form className="flex items-center gap-1" onSubmit={handleModify}>
          <span className="text-[0.6875rem] text-ink-muted">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-24 rounded-xs border border-line bg-surface-1 px-1.5 py-0.5 text-xs tabular-nums text-ink"
            aria-label="Actual amount"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-pill border border-brand bg-brand-soft px-2 py-0.5 text-[0.625rem] font-medium text-brand disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function ReviewButton({
  label,
  active = false,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "rounded-pill border px-2 py-0.5 text-[0.625rem] font-medium disabled:opacity-50",
        active
          ? "border-ink bg-ink text-surface-1"
          : "border-line bg-surface-1 text-ink-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "info" | "brand" | "danger" | "good";
}) {
  return (
    <span
      className={clsx(
        "rounded-pill border px-1.5 py-px font-medium",
        tone === "info" && "border-info bg-info-soft text-info-strong",
        tone === "brand" && "border-brand bg-brand-soft text-brand",
        tone === "danger" && "border-danger bg-danger-soft text-danger-strong",
        tone === "good" && "border-success bg-success-soft text-success-strong",
        tone === "neutral" && "border-line bg-surface-1 text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
