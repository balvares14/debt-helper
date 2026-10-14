/**
 * What happens on the selected day, and why.
 *
 * Every routing and extra-payment line carries the engine's reason, because
 * "put groceries on Card C" is only actionable if you can see it is the 0%
 * card and that cash was the alternative.
 */

import { clsx } from "clsx";

import { longDate, money, moneyTrim, percent } from "@/lib/format";
import type { DayItem, DayItemKind, ProjectedDay } from "@/lib/planApi";

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
            <ItemRow key={`${group.kind}-${index}`} item={item} />
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
function ItemRow({ item }: { item: DayItem }) {
  const isIncome = item.kind === "gain";
  const isCardSpend = item.kind === "charge" && item.method === "card";
  // Card spend does not touch cash, and interest is added to a balance rather
  // than withdrawn, so neither gets a minus sign.
  const affectsCash = !isCardSpend && item.kind !== "interest" && item.kind !== "back_interest" && item.kind !== "fee";
  const sign = isIncome ? "+" : affectsCash ? "−" : "";

  return (
    <div className="rounded-xs border border-line-soft bg-surface-2 px-2.5 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink">{item.name}</span>
        <span
          className={clsx(
            "shrink-0 text-xs font-semibold tabular-nums",
            isIncome ? "text-success-strong" : isCardSpend ? "text-info-strong" : "text-ink",
          )}
        >
          {sign}
          {moneyTrim(item.amount)}
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
      </div>

      {item.reason && (
        <p className="mt-1 text-[0.6875rem] leading-snug text-ink-muted">{item.reason}</p>
      )}
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "info" | "brand" | "danger";
}) {
  return (
    <span
      className={clsx(
        "rounded-pill border px-1.5 py-px font-medium",
        tone === "info" && "border-info bg-info-soft text-info-strong",
        tone === "brand" && "border-brand bg-brand-soft text-brand",
        tone === "danger" && "border-danger bg-danger-soft text-danger-strong",
        tone === "neutral" && "border-line bg-surface-1 text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
