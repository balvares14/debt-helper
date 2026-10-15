/**
 * The payment plan: what to do with money over the next few weeks, and where
 * each debt is heading.
 *
 * Grouped by date rather than by debt, because the question this answers is
 * "it's payday — what do I do now", not "tell me about Card B".
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";

import EmptyPlan from "@/components/plan/EmptyPlan";
import FullPlanModal from "@/components/plan/FullPlanModal";
import DebtBalanceChart from "@/components/plan/DebtBalanceChart";
import InterestMonthChart from "@/components/plan/InterestMonthChart";
import { PlanBanners, PlanStatus } from "@/components/plan/PlanStatus";
import { SectionCard } from "@/components/plan/fields";
import { usePlan } from "@/contexts/PlanContext";
import { addDaysISO, mediumDate, money, monthsLabel } from "@/lib/format";
import type { PlanAction } from "@/lib/planApi";

export default function PlanPage() {
  const { plan, loading } = usePlan();
  const [fullPlanOpen, setFullPlanOpen] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <p className="text-xs text-ink-muted">Loading…</p>
      </div>
    );
  }
  if (!plan) return null;

  const hasPlan = plan.debts.length > 0 || plan.events.length > 0;
  if (!hasPlan) return <EmptyPlan />;

  const { actions, summary, debts, strategy, nearTermDays, today } = plan.projection;
  const previewEnd = addDaysISO(today, nearTermDays ?? 45);
  const previewActions = actions.filter((action) => action.date <= previewEnd);
  const hasMore = actions.length > previewActions.length;

  // Same date, same decision point — that is how a payday actually feels.
  const byDate = previewActions.reduce<Map<string, PlanAction[]>>((map, action) => {
    const list = map.get(action.date) ?? [];
    list.push(action);
    map.set(action.date, list);
    return map;
  }, new Map());

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <header>
        <h1 className="text-base font-semibold text-ink">Your payment plan</h1>
        <p className="mt-0.5 max-w-prose text-[0.6875rem] leading-relaxed text-ink-muted">
          Where to send money, and which card or cash to use for each purchase. Recalculated from
          scratch every time you change anything.
        </p>
      </header>

      <PlanStatus />
      <PlanBanners banners={plan.projection.banners} />

      <SectionCard
        title="What the plan is worth"
        description="Compared with paying only the minimums, through the day the last debt clears."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Compare
            label="Interest you pay"
            planValue={money(summary.interestRemaining, { cents: false })}
            minimumsValue={money(summary.minimumsOnly.interestRemaining, { cents: false })}
          />
          <Compare
            label="Debt free by"
            planValue={summary.debtFreeDate ? mediumDate(summary.debtFreeDate) : "Over 5 years"}
            minimumsValue={
              summary.minimumsOnly.debtFreeDate
                ? mediumDate(summary.minimumsOnly.debtFreeDate)
                : "Over 5 years"
            }
          />
          <div className="rounded-xs border border-line bg-surface-2 px-2.5 py-2">
            <p className="text-[0.625rem] uppercase tracking-wide text-ink-faint">You save</p>
            <p className="mt-0.5 text-[0.9375rem] font-semibold tabular-nums text-success-strong">
              {money(summary.interestSaved, { cents: false })}
            </p>
            <p className="text-[0.625rem] text-ink-faint">
              {summary.monthsSaved
                ? `and finish ${monthsLabel(summary.monthsSaved)} sooner`
                : "in interest"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Next few weeks"
        description={
          strategy === "optimized"
            ? "Surplus goes at the highest rate you are actually paying. Only cash that stays clear of your floor is used."
            : "Surplus goes at your smallest balance so debts clear sooner. Only cash that stays clear of your floor is used."
        }
      >
        {byDate.size === 0 && !hasMore ? (
          <p className="text-[0.6875rem] leading-relaxed text-ink-faint">
            No extra payments or routing decisions are scheduled in this window. That usually means
            required bills and minimums already use everything, or there is no spending marked as
            card-eligible.{" "}
            <Link to="/setup" className="text-brand underline">
              Review your setup
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {[...byDate.entries()].map(([date, list]) => (
              <div key={date} className="flex flex-col gap-1.5">
                <p className="text-[0.6875rem] font-semibold text-ink-muted">{mediumDate(date)}</p>
                {list.map((action, index) => (
                  <ActionRow key={`${date}-${index}`} action={action} />
                ))}
              </div>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => setFullPlanOpen(true)}
                className="flex items-center justify-center gap-1 rounded-xs border border-dashed border-line bg-surface-2 py-2 text-[0.8125rem] font-semibold tracking-[0.2em] text-ink-muted hover:border-ink-faint hover:bg-surface-3 hover:text-ink"
                aria-label={`Show the rest of the plan through ${summary.debtFreeDate ? mediumDate(summary.debtFreeDate) : "payoff"}`}
                title={
                  summary.debtFreeDate
                    ? `Show every step through ${mediumDate(summary.debtFreeDate)}`
                    : "Show the rest of the plan"
                }
              >
                …
              </button>
            )}
          </div>
        )}
      </SectionCard>

      <FullPlanModal
        open={fullPlanOpen}
        onClose={() => setFullPlanOpen(false)}
        actions={actions}
        debts={debts}
        debtFreeDate={summary.debtFreeDate}
      />

      <SectionCard
        title="Balances over time"
        description="Each line is one debt under this plan. Steep drops are extra payoff; a rise is new spend on that card. The scale starts at $25k — raise it if a loan is taller, lower it to zoom in on the cards."
      >
        <DebtBalanceChart series={plan.projection.debtSeries} debts={debts} />
      </SectionCard>

      <SectionCard
        title="Interest charged each month"
        description="Same colors as the balance chart. Once a debt is gone, its slice is $0 and the stack shrinks to the axis."
      >
        <InterestMonthChart series={plan.projection.interestSeries} />
      </SectionCard>
    </div>
  );
}

function Compare({
  label,
  planValue,
  minimumsValue,
}: {
  label: string;
  planValue: string;
  minimumsValue: string;
}) {
  return (
    <div className="rounded-xs border border-line bg-surface-2 px-2.5 py-2">
      <p className="text-[0.625rem] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 text-[0.9375rem] font-semibold tabular-nums text-ink">{planValue}</p>
      <p className="text-[0.625rem] text-ink-faint">
        minimums only: <span className="tabular-nums">{minimumsValue}</span>
      </p>
    </div>
  );
}

function ActionRow({ action }: { action: PlanAction }) {
  const tone =
    action.kind === "extra_payment" ? "brand" : action.kind === "route_to_card" ? "info" : "neutral";

  return (
    <div className="flex gap-2 rounded-xs border border-line bg-surface-2 px-2.5 py-2">
      <span
        className={clsx(
          "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-pill",
          tone === "brand" && "bg-brand",
          tone === "info" && "bg-info",
          tone === "neutral" && "bg-ink-faint",
        )}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink">{action.title}</p>
        <p className="mt-0.5 text-[0.6875rem] leading-snug text-ink-muted">{action.detail}</p>
      </div>
    </div>
  );
}
