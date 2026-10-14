/**
 * Where the plan gets entered: starting cash, settings, debts, and the gains
 * and charges that drive the calendar.
 *
 * Every save recalculates the whole projection server-side, so the numbers on
 * the debt rows below are always the live ones.
 */

import { useEffect, useState } from "react";
import { SquarePen, Trash2 } from "lucide-react";

import CashEventForm from "@/components/plan/CashEventForm";
import DebtForm from "@/components/plan/DebtForm";
import { Field, FormActions, NumberInput, SectionCard, Select, TextInput } from "@/components/plan/fields";
import { PlanBanners } from "@/components/plan/PlanStatus";
import { fieldError, usePlan } from "@/contexts/PlanContext";
import {
  CADENCE_LABELS,
  PAYMENT_KIND_LABELS,
  PROMO_LABELS,
  mediumDate,
  money,
  moneyTrim,
  percent,
} from "@/lib/format";
import {
  clearPlan,
  deleteCashEvent,
  deleteDebt,
  loadDemoPlan,
  savePlanSettings,
  saveStartingCash,
  setDebtStatus,
  setCashEventStatus,
  type CashEvent,
  type Debt,
  type Direction,
  type ItemStatus,
  type ProjectedDebt,
  type Strategy,
} from "@/lib/planApi";

type Editing =
  | { type: "none" }
  | { type: "debt"; debt?: Debt }
  | { type: "event"; event?: CashEvent; direction: Direction };

export default function SetupPage() {
  const { plan, loading, save, saving } = usePlan();
  const [editing, setEditing] = useState<Editing>({ type: "none" });

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <p className="text-xs text-ink-muted">Loading…</p>
      </div>
    );
  }
  if (!plan) return null;

  const close = () => setEditing({ type: "none" });
  const projectedById = new Map<number, ProjectedDebt>(
    plan.projection.debts.map((debt) => [debt.id, debt]),
  );

  const gains = plan.events.filter((event) => event.direction === "gain");
  const charges = plan.events.filter((event) => event.direction === "charge");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4">
      <header>
        <h1 className="text-base font-semibold text-ink">Set up your plan</h1>
        <p className="mt-0.5 text-[0.6875rem] text-ink-muted">
          Changes save immediately and the whole plan recalculates.
        </p>
      </header>

      <PlanBanners banners={plan.projection.banners} />

      {/* Keyed on the saved values so an external change — loading the sample
          plan, clearing everything — resets these inputs instead of leaving
          the old numbers sitting in them. */}
      <StartingCashSection
        key={`cash:${plan.initialDeposit?.amount ?? "none"}:${plan.initialDeposit?.startDate ?? ""}`}
      />

      <SettingsSection
        key={`rules:${plan.settings.cashFloor}:${plan.settings.horizonMonths}:${plan.settings.strategy}`}
      />

      <SectionCard
        title="Debts"
        description="What you owe, at what rate, and when it is due. Set a row to Draft to keep it saved without using it in the plan."
        action={
          editing.type !== "debt" && (
            <AddButton onClick={() => setEditing({ type: "debt" })}>Add debt</AddButton>
          )
        }
      >
        {editing.type === "debt" && <DebtForm debt={editing.debt} onDone={close} />}

        {plan.debts.length === 0 && editing.type !== "debt" && (
          <Empty>No debts yet. Add the one with the highest rate first.</Empty>
        )}

        <div className="flex flex-col gap-2">
          {plan.debts.map((debt) => (
            <DebtRow
              key={debt.id}
              debt={debt}
              projected={projectedById.get(debt.id)}
              onEdit={() => setEditing({ type: "debt", debt })}
              onStatus={(status) => void save((planWindow) => setDebtStatus(debt.id, status, planWindow))}
              onDelete={() => void save((planWindow) => deleteDebt(debt.id, planWindow))}
              busy={saving}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Money coming in"
        description="Paychecks and any one-off gains. Draft ones stay on this list but do not add cash to the plan."
        action={
          !(editing.type === "event" && editing.direction === "gain") && (
            <AddButton onClick={() => setEditing({ type: "event", direction: "gain" })}>
              Add gain
            </AddButton>
          )
        }
      >
        {editing.type === "event" && editing.direction === "gain" && (
          <CashEventForm event={editing.event} direction="gain" onDone={close} />
        )}
        {gains.length === 0 && <Empty>No income yet. Without it, no extra payoff is possible.</Empty>}
        <EventList
          events={gains}
          plan={plan}
          onEdit={(event) => setEditing({ type: "event", event, direction: "gain" })}
          onStatus={(event, status) =>
            void save((planWindow) => setCashEventStatus(event.id, status, planWindow))
          }
          onDelete={(event) => void save((planWindow) => deleteCashEvent(event.id, planWindow))}
          busy={saving}
        />
      </SectionCard>

      <SectionCard
        title="Money going out"
        description="Bills and spending. Draft ones stay saved but are ignored by the calendar and payoff plan."
        action={
          !(editing.type === "event" && editing.direction === "charge") && (
            <AddButton onClick={() => setEditing({ type: "event", direction: "charge" })}>
              Add charge
            </AddButton>
          )
        }
      >
        {editing.type === "event" && editing.direction === "charge" && (
          <CashEventForm event={editing.event} direction="charge" onDone={close} />
        )}
        {charges.length === 0 && <Empty>No charges yet.</Empty>}
        <EventList
          events={charges}
          plan={plan}
          onEdit={(event) => setEditing({ type: "event", event, direction: "charge" })}
          onStatus={(event, status) =>
            void save((planWindow) => setCashEventStatus(event.id, status, planWindow))
          }
          onDelete={(event) => void save((planWindow) => deleteCashEvent(event.id, planWindow))}
          busy={saving}
        />
      </SectionCard>

      <SectionCard
        title="Start over"
        description="Load the sample plan to see how the routing behaves, or clear everything and begin again."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save((planWindow) => loadDemoPlan(planWindow))}
            className="rounded-xs border border-line bg-surface-1 px-3 py-1.5 text-[0.6875rem] font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-50"
          >
            Replace with sample plan
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!window.confirm("Delete every debt, gain and charge? This cannot be undone.")) {
                return;
              }
              void save((w) => clearPlan(w));
            }}
            className="rounded-xs border border-danger bg-surface-1 px-3 py-1.5 text-[0.6875rem] font-medium text-danger-strong hover:bg-danger-soft disabled:opacity-50"
          >
            Clear everything
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/** The opening balance. Everything in the projection is measured from here. */
function StartingCashSection() {
  const { plan, save, saving, fieldErrors, today } = usePlan();
  const deposit = plan?.initialDeposit ?? null;

  const [amount, setAmount] = useState(deposit ? String(deposit.amount) : "");
  const [date, setDate] = useState(deposit?.startDate ?? today);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await save((planWindow) => saveStartingCash({ amount: amount || 0, date }, planWindow));
  };

  return (
    <SectionCard
      title="Cash on hand"
      description="The balance you actually have available right now. It is recorded as your opening deposit, and the plan never schedules a payment that would take you below $0."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Field
          label="Amount"
          error={fieldError(fieldErrors, "amount")}
          className="w-40"
        >
          <NumberInput
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            invalid={!!fieldError(fieldErrors, "amount")}
          />
        </Field>

        <Field
          label="Accurate as of"
          error={fieldError(fieldErrors, "date")}
          className="w-44"
        >
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            invalid={!!fieldError(fieldErrors, "date")}
          />
        </Field>

        <div className="pb-[0.1rem]">
          <FormActions saving={saving} submitLabel={deposit ? "Update cash" : "Save cash"} />
        </div>
      </form>
    </SectionCard>
  );
}

function SettingsSection() {
  const { plan, save, saving, fieldErrors } = usePlan();
  const settings = plan?.settings;

  const [cashFloor, setCashFloor] = useState(String(settings?.cashFloor ?? 100));
  const [horizonMonths, setHorizonMonths] = useState(String(settings?.horizonMonths ?? 60));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await save((planWindow) =>
      savePlanSettings({ cashFloor: Number(cashFloor), horizonMonths: Number(horizonMonths) }, planWindow),
    );
  };

  if (!settings) return null;

  return (
    <SectionCard
      title="Rules"
      description="The buffer the plan protects, and how far ahead it looks."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Field
          label="Cash floor"
          hint="Extra payoff stops before dipping under this. 0 is allowed."
          error={fieldError(fieldErrors, "cashFloor")}
          className="w-44"
        >
          <NumberInput
            value={cashFloor}
            onChange={(event) => setCashFloor(event.target.value)}
            min="0"
            step="0.01"
            invalid={!!fieldError(fieldErrors, "cashFloor")}
          />
        </Field>

        <Field
          label="Strategy"
          hint="Optimized costs the least interest."
          className="w-44"
        >
          <Select
            value={settings.strategy}
            onChange={(event) =>
              void save((planWindow) =>
                savePlanSettings({ strategy: event.target.value as Strategy }, planWindow),
              )
            }
          >
            <option value="optimized">Optimized (highest rate)</option>
            <option value="snowball">Snowball (smallest balance)</option>
          </Select>
        </Field>

        <Field
          label="Project ahead"
          hint="Months, up to 60."
          error={fieldError(fieldErrors, "horizonMonths")}
          className="w-32"
        >
          <NumberInput
            value={horizonMonths}
            onChange={(event) => setHorizonMonths(event.target.value)}
            min="1"
            max="60"
            step="1"
            invalid={!!fieldError(fieldErrors, "horizonMonths")}
          />
        </Field>

        <div className="pb-[0.1rem]">
          <FormActions saving={saving} submitLabel="Save rules" />
        </div>
      </form>
    </SectionCard>
  );
}

function DebtRow({
  debt,
  projected,
  onEdit,
  onStatus,
  onDelete,
  busy,
}: {
  debt: Debt;
  projected: ProjectedDebt | undefined;
  onEdit: () => void;
  onStatus: (status: ItemStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isDraft = debt.status === "draft";

  return (
    <div
      className={`rounded-xs border border-line bg-surface-2 p-2.5 ${isDraft ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold text-ink">{debt.name}</span>
          <span className="text-[0.625rem] text-ink-faint">
            {debt.debtType === "loan" ? "Loan" : "Card"}
          </span>
          {isDraft && (
            <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
              Draft
            </span>
          )}
          {debt.promos.map((promo) => (
            <span
              key={promo.id}
              className={
                promo.kind === "deferred_interest"
                  ? "rounded-pill border border-warning bg-warning-soft px-1.5 py-px text-[0.625rem] font-medium text-warning-strong"
                  : "rounded-pill border border-info bg-info-soft px-1.5 py-px text-[0.625rem] font-medium text-info-strong"
              }
              title={`${PROMO_LABELS[promo.kind]} at ${percent(promo.apr)} until ${mediumDate(promo.endDate)}`}
            >
              {percent(promo.apr)} {PROMO_LABELS[promo.kind].toLowerCase()} → {mediumDate(promo.endDate)}
            </span>
          ))}
        </div>

        <RowActions
          name={debt.name}
          status={debt.status ?? "active"}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          busy={busy}
        />
      </div>

      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-6">
        <Cell label="Balance" value={money(debt.balance)} />
        <Cell label="APR" value={percent(debt.apr)} />
        <Cell label="Due" value={`Day ${debt.dueDay}`} />
        <Cell
          label={debt.paymentKind === "fixed" ? "Payment" : "Est. minimum"}
          value={
            isDraft
              ? "—"
              : debt.paymentKind === "fixed"
                ? moneyTrim(debt.fixedPayment ?? 0)
                : projected
                  ? moneyTrim(projected.estimatedMinimum)
                  : "—"
          }
          hint={PAYMENT_KIND_LABELS[debt.paymentKind]}
        />
        {debt.creditLimit !== null && (
          <Cell
            label="Available credit"
            value={moneyTrim(Math.max(0, debt.creditLimit - debt.balance))}
            hint={`of ${money(debt.creditLimit, { cents: false })}`}
          />
        )}
        <Cell
          label="Projected payoff"
          value={
            isDraft
              ? "Not in plan"
              : projected?.paidOffDate
                ? mediumDate(projected.paidOffDate)
                : "Over 5 years"
          }
        />
      </dl>

      {debt.notes && (
        <p className="mt-1.5 text-[0.625rem] leading-snug text-ink-faint">{debt.notes}</p>
      )}
    </div>
  );
}

function EventList({
  events,
  plan,
  onEdit,
  onStatus,
  onDelete,
  busy,
}: {
  events: CashEvent[];
  plan: NonNullable<ReturnType<typeof usePlan>["plan"]>;
  onEdit: (event: CashEvent) => void;
  onStatus: (event: CashEvent, status: ItemStatus) => void;
  onDelete: (event: CashEvent) => void;
  busy: boolean;
}) {
  if (events.length === 0) return null;

  const debtName = (id: number | null) =>
    plan.debts.find((debt) => debt.id === id)?.name ?? "a card";

  return (
    <div className="flex flex-col gap-1.5">
      {events.map((event) => {
        const isDraft = event.status === "draft";
        return (
          <div
            key={event.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xs border border-line bg-surface-2 px-2.5 py-2 ${
              isDraft ? "opacity-70" : ""
            }`}
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <span className="text-xs font-medium text-ink">{event.name}</span>
              <span
                className={
                  event.direction === "gain"
                    ? "text-xs font-semibold tabular-nums text-success-strong"
                    : "text-xs font-semibold tabular-nums text-ink"
                }
              >
                {event.direction === "gain" ? "+" : "−"}
                {moneyTrim(event.amount)}
              </span>
              {isDraft && (
                <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
                  Draft
                </span>
              )}
              <span className="text-[0.625rem] text-ink-faint">
                {CADENCE_LABELS[event.cadence]} from {mediumDate(event.startDate)}
                {event.endDate ? ` until ${mediumDate(event.endDate)}` : ""}
              </span>
              {event.direction === "charge" && (
                <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] text-ink-muted">
                  {event.paymentMethod === "cash" && "Cash"}
                  {event.paymentMethod === "card" &&
                    `${debtName(event.paymentDebtId)}${event.locked ? " (pinned)" : ""}`}
                  {event.paymentMethod === "optimizer" && "Plan decides"}
                </span>
              )}
            </div>

            <RowActions
              name={event.name}
              status={event.status ?? "active"}
              onEdit={() => onEdit(event)}
              onStatus={(status) => onStatus(event, status)}
              onDelete={() => onDelete(event)}
              busy={busy}
            />
          </div>
        );
      })}
    </div>
  );
}

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-[0.6875rem] font-medium tabular-nums text-ink">{value}</dd>
      {hint && <dd className="text-[0.625rem] text-ink-faint">{hint}</dd>}
    </div>
  );
}

function RowActions({
  name,
  status,
  onEdit,
  onStatus,
  onDelete,
  busy,
}: {
  name: string;
  status: ItemStatus;
  onEdit: () => void;
  onStatus: (status: ItemStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isDraft = status === "draft";
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 2500);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton label={`Edit ${name}`} onClick={onEdit} disabled={busy}>
        <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
      </IconButton>

      <IconButton
        label={
          isDraft
            ? `${name} is draft — click to activate`
            : `${name} is active — click to set as draft`
        }
        onClick={() => onStatus(isDraft ? "active" : "draft")}
        disabled={busy}
      >
        <span
          aria-hidden
          className={
            isDraft
              ? "h-3.5 w-3.5 rounded-full border-[1.5px] border-ink-faint bg-transparent"
              : "h-3.5 w-3.5 rounded-full bg-[#86efac]"
          }
        />
      </IconButton>

      <IconButton
        label={armed ? `Click again to delete ${name}` : `Double-click to delete ${name}`}
        danger
        armed={armed}
        disabled={busy}
        onClick={() => {
          if (armed) {
            setArmed(false);
            onDelete();
            return;
          }
          setArmed(true);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  armed = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  armed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 select-none items-center justify-center rounded-xs disabled:opacity-50 ${
        danger
          ? armed
            ? "bg-danger-soft text-danger-strong"
            : "text-danger hover:bg-danger-soft"
          : "text-ink-muted hover:bg-surface-3"
      }`}
    >
      {children}
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xs bg-ink px-2.5 py-1 text-[0.6875rem] font-medium text-surface-1"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.6875rem] text-ink-faint">{children}</p>;
}
