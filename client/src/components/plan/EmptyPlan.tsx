/**
 * First run. Two ways forward: load the sample plan to see what the app does,
 * or enter the one number everything else is built on.
 */

import { Link } from "react-router-dom";

import { usePlan } from "@/contexts/PlanContext";
import { loadDemoPlan } from "@/lib/planApi";

export default function EmptyPlan() {
  const { save, saving } = usePlan();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="rounded-card border border-line bg-surface-1 p-5">
        <h1 className="text-base font-semibold text-ink">Let's build your payoff plan</h1>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-muted">
          It starts with one number: the cash you have right now. From there, add what you owe and
          the money moving in and out, and you get a day-by-day calendar showing what you will
          have in the bank — plus which card or cash to use for each purchase so you pay the least
          interest.
        </p>

        <ol className="mt-4 flex flex-col gap-2">
          <Step number={1} title="Enter your cash on hand">
            One opening deposit, so the plan knows what it is working with.
          </Step>
          <Step number={2} title="Add your debts">
            Balances, rates and due dates. Promotional 0% offers are supported, including when
            they only cover part of a balance.
          </Step>
          <Step number={3} title="Add income and bills">
            Paychecks, rent, groceries. Mark the ones a card could absorb.
          </Step>
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/setup"
            className="rounded-xs bg-ink px-3 py-1.5 text-xs font-medium text-surface-1"
          >
            Start setup
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save((planWindow) => loadDemoPlan(planWindow))}
            className="rounded-xs border border-line bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-50"
          >
            {saving ? "Loading…" : "Load sample plan"}
          </button>
        </div>

        <p className="mt-3 text-[0.625rem] leading-relaxed text-ink-faint">
          The sample plan is a deliberately awkward one: an expensive card, a 0% card, a car loan,
          and rent that falls due before the next paycheck. It is there to show the plan refusing
          to drain your account.
        </p>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-[0.625rem] font-semibold text-ink-muted">
        {number}
      </span>
      <span>
        <span className="text-xs font-medium text-ink">{title}</span>
        <p className="text-[0.6875rem] leading-relaxed text-ink-muted">{children}</p>
      </span>
    </li>
  );
}
