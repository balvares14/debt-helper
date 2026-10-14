/**
 * The month grid.
 *
 * The number that matters on each cell is the balance you are left with at the
 * end of that day, so it gets the most weight. A day that ends below zero is
 * filled red rather than merely tinted — the point of the calendar is that you
 * can spot trouble without reading any numbers.
 */

import { useMemo } from "react";
import { clsx } from "clsx";

import {
  WEEKDAY_INITIALS,
  buildISO,
  daysInMonth,
  endOfMonthISO,
  moneyCompact,
  monthKeyOf,
  parseISO,
  startOfMonthISO,
  weekdayOf,
} from "@/lib/format";
import type { ProjectedDay } from "@/lib/planApi";

export interface MonthCalendarProps {
  /** Any date inside the month to render. */
  month: string;
  today: string;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  dayFor: (iso: string) => ProjectedDay | undefined;
  cashFloor: number;
}

interface Cell {
  date: string;
  inMonth: boolean;
}

/** Always six weeks, so paging between months never shifts the layout. */
const GRID_CELLS = 42;

function buildCells(month: string): Cell[] {
  const start = startOfMonthISO(month);
  const { year, month: monthNumber } = parseISO(start);
  const total = daysInMonth(year, monthNumber);
  const leading = weekdayOf(start);

  const cells: Cell[] = [];

  // Trailing days of the previous month, for context.
  for (let offset = leading; offset > 0; offset -= 1) {
    const previous = new Date(Date.UTC(year, monthNumber - 1, 1 - offset));
    cells.push({ date: previous.toISOString().slice(0, 10), inMonth: false });
  }

  for (let day = 1; day <= total; day += 1) {
    cells.push({ date: buildISO(year, monthNumber, day), inMonth: true });
  }

  // Leading days of the following month fill the rest of the six-week grid.
  while (cells.length < GRID_CELLS) {
    const next = new Date(Date.UTC(year, monthNumber - 1, cells.length - leading + 1));
    cells.push({ date: next.toISOString().slice(0, 10), inMonth: false });
  }

  return cells;
}

export default function MonthCalendar({
  month,
  today,
  selectedDate,
  onSelectDate,
  dayFor,
  cashFloor,
}: MonthCalendarProps) {
  const cells = useMemo(() => buildCells(month), [month]);
  const monthKey = monthKeyOf(startOfMonthISO(month));

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-1">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {WEEKDAY_INITIALS.map((name) => (
          <div
            key={name}
            className="px-2 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <DayCell
            key={cell.date}
            date={cell.date}
            inMonth={monthKeyOf(cell.date) === monthKey}
            isToday={cell.date === today}
            isPast={cell.date < today}
            isSelected={cell.date === selectedDate}
            day={dayFor(cell.date)}
            cashFloor={cashFloor}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  day: ProjectedDay | undefined;
  cashFloor: number;
  onSelect: (iso: string) => void;
}

function DayCell({
  date,
  inMonth,
  isToday,
  isPast,
  isSelected,
  day,
  cashFloor,
  onSelect,
}: DayCellProps) {
  const { day: dayNumber } = parseISO(date);

  const negative = !!day?.negative;
  const belowFloor = !!day?.belowFloor && cashFloor > 0;
  const hasExtra = !!day?.items.some((item) => item.kind === "extra_payment");

  // One opacity class only: two of them collide, and which wins depends on
  // stylesheet order rather than the order written here.
  const dim = !inMonth ? "opacity-40" : isPast && !negative ? "opacity-60" : undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={date}
      aria-current={isToday ? "date" : undefined}
      className={clsx(
        "relative flex h-[5.75rem] flex-col items-stretch gap-0.5 border-b border-r border-line p-1.5 text-left align-top transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        negative
          ? "bg-danger-soft hover:bg-danger-soft"
          : belowFloor
            ? "bg-warning-soft"
            : "bg-surface-1 hover:bg-surface-2",
        dim,
        isSelected && "ring-2 ring-inset ring-focus",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span
          className={clsx(
            "text-[0.6875rem] font-medium",
            isToday
              ? "rounded-pill bg-ink px-1.5 py-0.5 text-surface-1"
              : negative
                ? "text-danger-strong"
                : "text-ink-muted",
          )}
        >
          {dayNumber}
        </span>

        {day && (
          <span
            className={clsx(
              "text-[0.8125rem] font-semibold tabular-nums",
              negative
                ? "text-danger-strong"
                : belowFloor
                  ? "text-warning-strong"
                  : "text-ink",
            )}
          >
            {moneyCompact(day.endCash)}
          </span>
        )}
      </div>

      {day && (
        <div className="flex flex-col gap-px overflow-hidden text-[0.625rem] leading-tight">
          {day.gains > 0 && (
            <span className="truncate font-medium text-success-strong">
              +{moneyCompact(day.gains)}
            </span>
          )}
          {day.cashCharges > 0 && (
            <span className="truncate text-ink-muted">−{moneyCompact(day.cashCharges)} cash</span>
          )}
          {day.cardSpend > 0 && (
            <span className="truncate text-info-strong">
              {moneyCompact(day.cardSpend)} on card
            </span>
          )}
          {day.payments > 0 && (
            <span
              className={clsx(
                "truncate",
                hasExtra ? "font-medium text-brand" : "text-ink-muted",
              )}
            >
              {hasExtra ? "▸ " : ""}
              {moneyCompact(day.payments)} to debt
            </span>
          )}
        </div>
      )}
    </button>
  );
}
