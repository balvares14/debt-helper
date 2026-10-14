/**
 * Top-of-page status: the handful of numbers worth checking every time, the
 * strategy toggle, and any banners.
 */

import { clsx } from "clsx";

import { usePlan } from "@/contexts/PlanContext";
import { mediumDate, money, monthsLabel } from "@/lib/format";
import { savePlanSettings, type Banner, type Strategy } from "@/lib/planApi";

export function PlanBanners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {banners.map((banner, index) => (
        <div
          key={`${banner.title}-${index}`}
          role={banner.level === "critical" ? "alert" : "status"}
          className={clsx(
            "rounded-card border px-3 py-2",
            banner.level === "critical" && "border-danger bg-danger-soft",
            banner.level === "warning" && "border-warning bg-warning-soft",
            banner.level === "info" && "border-info bg-info-soft",
          )}
        >
          <p
            className={clsx(
              "text-xs font-semibold",
              banner.level === "critical" && "text-danger-strong",
              banner.level === "warning" && "text-warning-strong",
              banner.level === "info" && "text-info-strong",
            )}
          >
            {banner.title}
          </p>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink">{banner.message}</p>
          {banner.actions && banner.actions.length > 0 && (
            <p className="mt-1 text-[0.6875rem] text-ink-muted">
              Options: {banner.actions.join(" · ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function PlanStatus() {
  const { plan, save, saving } = usePlan();
  if (!plan) return null;

  const { summary, strategy, cashFloor } = plan.projection;

  const setStrategy = (next: Strategy) => {
    if (next === strategy) return;
    void save((planWindow) => savePlanSettings({ strategy: next }, planWindow));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Cash on hand" value={money(summary.cashOnHand)} />
        <Stat label="Total debt" value={money(summary.totalDebt, { cents: false })} />
        <Stat
          label="Debt free"
          value={summary.debtFreeDate ? mediumDate(summary.debtFreeDate) : "Over 5 years"}
          hint={summary.debtFreeDate ? monthsLabel(summary.monthsToDebtFree) : undefined}
          tone={summary.debtFreeDate ? "good" : "warn"}
        />
        <Stat
          label="Interest left"
          value={money(summary.interestRemaining, { cents: false })}
          hint={
            summary.interestSaved > 0
              ? `${money(summary.interestSaved, { cents: false })} less than minimums`
              : undefined
          }
        />
        <Stat
          label="Lowest cash"
          value={money(summary.lowestCash, { cents: false })}
          hint={mediumDate(summary.lowestCashDate)}
          tone={
            summary.lowestCash < 0 ? "bad" : summary.lowestCash < cashFloor ? "warn" : "good"
          }
        />
        <Stat
          label="Cash floor"
          value={money(cashFloor, { cents: false })}
          hint="Buffer to stay above"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.6875rem] font-medium text-ink-muted">Payoff strategy</span>
        <div className="inline-flex overflow-hidden rounded-xs border border-line">
          <StrategyButton
            active={strategy === "optimized"}
            disabled={saving}
            onClick={() => setStrategy("optimized")}
            title="Attack the highest rate you are actually paying. Costs the least interest."
          >
            Optimized
          </StrategyButton>
          <StrategyButton
            active={strategy === "snowball"}
            disabled={saving}
            onClick={() => setStrategy("snowball")}
            title="Clear the smallest balance first. Costs more interest, but debts disappear sooner."
          >
            Snowball
          </StrategyButton>
        </div>
        <p className="text-[0.6875rem] text-ink-faint">{plan.projection.assumption}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div className="bg-surface-1 px-3 py-2">
      <p className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className={clsx(
          "mt-0.5 text-[0.9375rem] font-semibold tabular-nums",
          tone === "bad" && "text-danger-strong",
          tone === "warn" && "text-warning-strong",
          tone === "good" && "text-ink",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[0.625rem] leading-tight text-ink-faint">{hint}</p>}
    </div>
  );
}

function StrategyButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={clsx(
        "px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
        active ? "bg-ink text-surface-1" : "bg-surface-1 text-ink-muted hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </button>
  );
}
