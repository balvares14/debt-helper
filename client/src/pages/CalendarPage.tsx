/**
 * The default view: a month of days, each showing what you are left with.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import AddItemModal from "@/components/plan/AddItemModal";
import DayDetail from "@/components/plan/DayDetail";
import MonthCalendar from "@/components/plan/MonthCalendar";
import { PlanBanners, PlanStatus } from "@/components/plan/PlanStatus";
import EmptyPlan from "@/components/plan/EmptyPlan";
import { usePlan } from "@/contexts/PlanContext";
import { addMonthsISO, longDate, monthKeyOf, monthLabel, startOfMonthISO } from "@/lib/format";

export default function CalendarPage() {
  const { plan, loading, error, today, visibleMonth, goToMonth, shiftMonth, dayFor } = usePlan();
  const [selectedDate, setSelectedDate] = useState(today);
  const [adding, setAdding] = useState(false);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    if (monthKeyOf(date) !== monthKeyOf(visibleMonth)) goToMonth(date);
  };

  const onShiftMonth = (delta: number) => {
    const next = addMonthsISO(visibleMonth, 1 * delta);
    shiftMonth(delta);
    setSelectedDate(monthKeyOf(today) === monthKeyOf(next) ? today : startOfMonthISO(next));
  };

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

  const hasPlan = plan.debts.length > 0 || plan.events.length > 0;
  if (!hasPlan) return <EmptyPlan />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
      <PlanStatus />
      <PlanBanners banners={plan.projection.banners} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <NavButton onClick={() => onShiftMonth(-1)} label="Previous month">
            ‹
          </NavButton>
          <h1 className="min-w-[10rem] text-center text-[0.9375rem] font-semibold text-ink">
            {monthLabel(visibleMonth)}
          </h1>
          <NavButton onClick={() => onShiftMonth(1)} label="Next month">
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
          onSelectDate={selectDate}
          dayFor={dayFor}
          cashFloor={plan.projection.cashFloor}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-card border border-line bg-surface-1 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Add to {longDate(selectedDate)}
          </button>
          <DayDetail
            date={selectedDate}
            day={dayFor(selectedDate)}
            cashFloor={plan.projection.cashFloor}
            isToday={selectedDate === today}
          />
          <AddItemModal open={adding} date={selectedDate} onClose={() => setAdding(false)} />
          <p className="px-1 text-[0.6875rem] leading-relaxed text-ink-faint">
            Each day shows the cash you are left with after that day's money in, spending and
            payments. On today and earlier days, confirm, skip, or change an amount so the next
            extras use what actually happened.{" "}
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
