/**
 * First-run home. Short path in: add money in, money out, and debts.
 */

import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, ShoppingBag, Wallet } from "lucide-react";

import { Spinner } from "@/components/common/Spinner";
import { usePlan } from "@/contexts/PlanContext";
import { loadDemoPlan } from "@/lib/planApi";

export default function EmptyPlan() {
  const { save, saving } = usePlan();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-xl flex-col justify-center px-4 py-10 sm:py-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand">
        Debt planner
      </p>
      <h1 className="mt-2 text-display text-ink">The most efficient payoff plan</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
        It builds the cheapest path out of debt, then adjusts as you go. Add
        gains and losses — paychecks, groceries, the rest — and what you owe.
      </p>

      <ul className="mt-8 grid gap-2 sm:grid-cols-3">
        <Hint icon={Wallet} title="Money in" detail="Paychecks, cash on hand" />
        <Hint icon={ShoppingBag} title="Money out" detail="Groceries, rent, bills" />
        <Hint icon={CreditCard} title="Debts" detail="Cards and loans" />
      </ul>

      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Link
          to="/setup"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(79,168,85,0.32)] transition hover:bg-brand-strong hover:shadow-[0_10px_26px_rgba(79,168,85,0.4)]"
        >
          Start
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save((planWindow) => loadDemoPlan(planWindow))}
          className="inline-flex min-h-[2.625rem] min-w-[8.5rem] items-center justify-center rounded-pill bg-brand-soft px-6 py-2.5 text-sm font-semibold text-brand transition hover:bg-[#c8e9cc] disabled:opacity-50"
        >
          {saving ? <Spinner size={16} /> : "Try a sample"}
        </button>
      </div>
    </div>
  );
}

function Hint({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Wallet;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-surface-1 px-3.5 py-3 sm:flex-col sm:gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span>
        <span className="block text-xs font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[0.6875rem] leading-snug text-ink-muted">{detail}</span>
      </span>
    </li>
  );
}
