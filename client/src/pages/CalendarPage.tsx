/**
 * The default view: a month of days, each showing what you are left with.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import DayDetail from "@/components/plan/DayDetail";
import MonthCalendar from "@/components/plan/MonthCalendar";
import { PlanBanners, PlanStatus } from "@/components/plan/PlanStatus";
import EmptyPlan from "@/components/plan/EmptyPlan";
import { usePlan } from "@/contexts/PlanContext";
import { monthKeyOf, monthLabel, startOfMonthISO } from "@/lib/format";

export default function CalendarPage() {
  const { plan, loading, error, today, visibleMonth, goToMonth, shiftMonth, dayFor } = usePlan();
  const [selectedDate, setSelectedDate] = useState(today);

  // Keep the selection inside the month on screen, so the panel never
  // describes a day the user cannot see.
  useEffect(() => {
    if (monthKeyOf(selectedDate) === monthKeyOf(visibleMonth)) return;
    setSelectedDate(
      monthKeyOf(today) === monthKeyOf(visibleMonth) ? today : startOfMonthISO(visibleMonth),
    );
  }, [visibleMonth, today, selectedDate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <p className="text-xs text-ink-muted">Building your plan…</p>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="rounded-card border border-danger bg-danger-soft px-3 py-2 text-xs text-danger-strong">
          {error}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  const hasPlan = plan.debts.length > 0 || plan.events.length > 0 || !!plan.initialDeposit;
  if (!hasPlan) return <EmptyPlan />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
      <PlanStatus />
      <PlanBanners banners={plan.projection.banners} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <NavButton onClick={() => shiftMonth(-1)} label="Previous month">
            ‹
          </NavButton>
          <h1 className="min-w-[10rem] text-center text-[0.9375rem] font-semibold text-ink">
            {monthLabel(visibleMonth)}
          </h1>
          <NavButton onClick={() => shiftMonth(1)} label="Next month">
            ›
          </NavButton>
          <button
            type="button"
            onClick={() => {
              goToMonth(today);
              setSelectedDate(today);
            }}
            className="ml-1 rounded-xs border border-line bg-surface-1 px-2 py-1 text-[0.6875rem] font-medium text-ink-muted hover:bg-surface-2"
          >
            Today
          </button>
        </div>

        <Legend />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <MonthCalendar
          month={visibleMonth}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dayFor={dayFor}
          cashFloor={plan.projection.cashFloor}
        />

        <div className="flex flex-col gap-3">
          <DayDetail
            date={selectedDate}
            day={dayFor(selectedDate)}
            cashFloor={plan.projection.cashFloor}
            isToday={selectedDate === today}
          />
          <p className="px-1 text-[0.6875rem] leading-relaxed text-ink-faint">
            Each day shows the cash you are left with after that day's money in, spending and
            payments. Extra payoff is only scheduled from cash that stays clear of your floor
            through the rest of the plan.{" "}
            <Link to="/plan" className="text-brand underline">
              See the full payment plan
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-7 w-7 rounded-xs border border-line bg-surface-1 text-sm text-ink-muted hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-[0.625rem] text-ink-faint">
      <LegendSwatch className="border-danger bg-danger-soft" label="Overdrawn" />
      <LegendSwatch className="border-warning bg-warning-soft" label="Below floor" />
      <span className="flex items-center gap-1">
        <span className="font-medium text-success-strong">+</span> money in
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-info-strong">▪</span> on a card
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium text-brand">▸</span> extra payoff
      </span>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}
