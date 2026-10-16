/**
 * Where the plan gets entered: settings, debts, and the gains and charges
 * that drive the calendar. Cash on hand is the running ledger of those
 * dated gains — add a one-time "Initial cash" gain if you are just starting.
 *
 * Every save recalculates the whole projection server-side, so the numbers on
 * the debt rows below are always the live ones.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  CreditCard,
  Plus,
  Settings,
  SquarePen,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { PageSpinner, Spinner } from "@/components/common/Spinner";
import FloatingNotice from "@/components/notices/FloatingNotice";
import CashEventForm from "@/components/plan/CashEventForm";
import DebtForm from "@/components/plan/DebtForm";
import { ItemEditorModal } from "@/components/plan/ItemEditorModal";
import { PlanBanners } from "@/components/plan/PlanStatus";
import { useNotification } from "@/contexts/NotificationContext";
import { fieldError, usePlan } from "@/contexts/PlanContext";
import type { NoticeTone } from "@/components/notices/tones";
import {
  CADENCE_LABELS,
  PROMO_LABELS,
  mediumDate,
  money,
  moneyTrim,
  percent,
  shortDate,
} from "@/lib/format";
import {
  clearPlan,
  deleteCashEvent,
  deleteDebt,
  loadDemoPlan,
  savePlanSettings,
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
        <PageSpinner />
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
  const editorTitle =
    editing.type === "debt"
      ? editing.debt
        ? "Edit debt"
        : "Add debt"
      : editing.type === "event"
        ? editing.direction === "gain"
          ? editing.event
            ? "Edit income"
            : "Add income"
          : editing.event
            ? "Edit expense"
            : "Add expense"
        : "";

  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-3 overflow-x-hidden p-4">
      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand">
          Setup
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">Your plan</h1>
      </header>

      <PlanBanners
        banners={plan.projection.banners.filter((banner) => banner.title !== "Below your cash floor")}
      />

      <SettingsSection />

      <SetupSection icon={Wallet} title="Income & expenses">
        <CashGroup
          title="Income"
          action={
            !(editing.type === "event" && editing.direction === "gain") && (
              <AddButton
                label="Add income"
                onClick={() => setEditing({ type: "event", direction: "gain" })}
              />
            )
          }
        >
          {gains.length === 0 && (
            <Empty>Paychecks, cash on hand</Empty>
          )}
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
        </CashGroup>

        <div className="border-t border-line" />

        <CashGroup
          title="Expenses"
          action={
            !(editing.type === "event" && editing.direction === "charge") && (
              <AddButton
                label="Add expense"
                tone="danger"
                onClick={() => setEditing({ type: "event", direction: "charge" })}
              />
            )
          }
        >
          {charges.length === 0 && <Empty>Groceries, rent, bills</Empty>}
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
        </CashGroup>
      </SetupSection>

      <SetupSection
        icon={CreditCard}
        title="Debt"
        action={
          editing.type !== "debt" && (
            <AddButton
              label="Add debt"
              tone="warning"
              onClick={() => setEditing({ type: "debt" })}
            />
          )
        }
      >
        {plan.debts.length === 0 && <Empty>Cards and loans</Empty>}

        <div className="flex flex-col gap-1.5">
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
      </SetupSection>

      <PlanOptions />

      <ItemEditorModal open={editing.type !== "none"} title={editorTitle} onClose={close}>
        {editing.type === "debt" && <DebtForm debt={editing.debt} plain onDone={close} />}
        {editing.type === "event" && (
          <CashEventForm
            event={editing.event}
            direction={editing.direction}
            plain
            onDone={close}
          />
        )}
      </ItemEditorModal>
    </div>
  );
}

type RuleNotice = {
  kind: "save" | "floor";
  title: string;
  subtext?: string;
  tone: NoticeTone;
  icon: "spinner" | "auto";
  duration: number;
};

function SettingsSection() {
  const { plan } = usePlan();
  if (!plan?.settings) return null;
  return <RulesBadges />;
}

function RulesBadges() {
  const { plan, save, saving, fieldErrors } = usePlan();
  const { showWarning } = useNotification();
  const settings = plan!.settings;
  const summary = plan!.projection.summary;

  const [cashFloor, setCashFloor] = useState(String(settings.cashFloor));
  const [strategy, setStrategy] = useState<Strategy>(settings.strategy);
  const [notice, setNotice] = useState<RuleNotice | null>(null);
  const [floorNoticeDismissed, setFloorNoticeDismissed] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [saveLeaving, setSaveLeaving] = useState(false);

  useEffect(() => {
    setCashFloor(String(settings.cashFloor));
    setStrategy(settings.strategy);
  }, [settings.cashFloor, settings.strategy]);

  const floorNumber = Number(cashFloor);
  const floorDirty = !Number.isFinite(floorNumber) || floorNumber !== settings.cashFloor;
  const strategyDirty = strategy !== settings.strategy;
  const dirty = floorDirty || strategyDirty;
  const floorError = fieldError(fieldErrors, "cashFloor");

  // Empty accounts always sit at $0 under the default $100 floor. Wait until
  // they have a gain or a debt so the warning is about a real plan.
  const hasStarted = plan!.events.length > 0 || plan!.debts.length > 0;
  const draftBelowFloor =
    hasStarted &&
    Number.isFinite(floorNumber) &&
    floorNumber > 0 &&
    summary.lowestCash >= 0 &&
    summary.lowestCash < floorNumber;

  const floorIssueMessage = draftBelowFloor
    ? `Cash stays above $0 but dips to ${money(summary.lowestCash)} on ${mediumDate(summary.lowestCashDate)}, under a ${money(floorNumber, { cents: false })} floor. Extra payoff pauses while you are under it.`
    : "";

  useEffect(() => {
    if (dirty) {
      setSaveVisible(true);
      setSaveLeaving(false);
      return;
    }
    if (!saveVisible) return undefined;
    setSaveLeaving(true);
    const timer = window.setTimeout(() => {
      setSaveVisible(false);
      setSaveLeaving(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [dirty, saveVisible]);

  useEffect(() => {
    if (notice?.kind === "save") return;
    if (!dirty || !draftBelowFloor || floorNoticeDismissed) {
      if (notice?.kind === "floor") setNotice(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setNotice({
        kind: "floor",
        title: "Below your cash floor",
        subtext: floorIssueMessage,
        tone: "warning",
        icon: "auto",
        duration: 0,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [dirty, draftBelowFloor, floorIssueMessage, floorNoticeDismissed, notice?.kind]);

  const persist = async () => {
    setNotice({ kind: "save", title: "Saving…", tone: "info", icon: "spinner", duration: 0 });

    const ok = await save(
      (planWindow) => savePlanSettings({ cashFloor: floorNumber, strategy }, planWindow),
      { silent: true },
    );

    setNotice({
      kind: "save",
      title: ok ? "Rules saved" : "Could not save rules",
      tone: ok ? "success" : "error",
      icon: "auto",
      duration: ok ? 2500 : 3500,
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={ruleBadgeClass(floorDirty, !!floorError, draftBelowFloor)}
          title="Extra payoff stops before dipping under this. 0 is allowed."
        >
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-faint">
              Cash floor
            </span>
            <span className="text-xs text-ink-muted">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cashFloor}
              onChange={(event) => {
                setFloorNoticeDismissed(false);
                setCashFloor(event.target.value);
              }}
              onWheel={(event) => event.currentTarget.blur()}
              className="badge-number min-w-[3ch] bg-transparent text-xs font-semibold tabular-nums text-ink outline-none"
              style={{ width: `${Math.max(String(cashFloor).length, 3)}ch` }}
              aria-invalid={!!floorError}
            />
          </label>
          {draftBelowFloor && (
            <button
              type="button"
              onClick={() => showWarning(floorIssueMessage, { title: "Below your cash floor" })}
              className="inline-flex h-4 w-4 items-center justify-center text-warning"
              aria-label="Below your cash floor"
              title="Below your cash floor"
            >
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          )}
        </div>

        <label
          className={ruleBadgeClass(strategyDirty)}
          title="Optimized costs the least interest. Snowball knocks out the smallest balance first."
        >
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-ink-faint">
            Strategy
          </span>
          <span className="relative inline-flex items-center">
            <select
              value={strategy}
              onChange={(event) => {
                setFloorNoticeDismissed(false);
                setStrategy(event.target.value as Strategy);
              }}
              className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-semibold text-ink outline-none"
            >
              <option value="optimized">Optimized</option>
              <option value="snowball">Snowball</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 h-3 w-3 text-ink-faint"
              strokeWidth={2}
              aria-hidden
            />
          </span>
        </label>
      </div>

      {floorError && (
        <p className="mt-1.5 text-[0.625rem] leading-snug text-danger-strong">{floorError}</p>
      )}

      {saveVisible &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[1300] flex justify-center">
            <button
              key={saveLeaving ? "out" : "in"}
              type="button"
              disabled={saving || saveLeaving}
              onClick={() => void persist()}
              className={`${saveLeaving ? "animate-bounce-out" : "animate-bounce-in"} pointer-events-auto inline-flex min-h-[2.25rem] min-w-[5.75rem] items-center justify-center rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(79,168,85,0.35)] disabled:opacity-60`}
            >
              {saving ? <Spinner size={16} className="text-white" /> : "Save"}
            </button>
          </div>,
          document.body,
        )}

      <FloatingNotice
        open={!!notice}
        title={notice?.title ?? ""}
        subtext={notice?.subtext}
        tone={notice?.tone ?? "info"}
        icon={notice?.icon ?? "auto"}
        compact={notice?.kind !== "floor"}
        position="bottom-right"
        duration={notice?.duration ?? 0}
        dismissible={notice?.kind === "floor" || (!!notice && notice.duration > 0)}
        showCloseButton={notice?.kind === "floor"}
        zIndex={1400}
        onClose={() => {
          if (notice?.kind === "floor") setFloorNoticeDismissed(true);
          setNotice(null);
        }}
      />
    </div>
  );
}

function ruleBadgeClass(dirty: boolean, invalid = false, caution = false) {
  const base = "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1";
  if (invalid) return `${base} border-danger bg-danger-soft`;
  if (caution) return `${base} border-warning bg-warning-soft`;
  if (dirty) return `${base} border-brand bg-brand-soft`;
  return `${base} border-line bg-surface-2`;
}

function ActiveSince({ date, active }: { date: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[0.625rem] text-ink-faint">
      {active && (
        <Check className="size-3 shrink-0 text-success-strong" strokeWidth={2.5} aria-hidden />
      )}
      active since {mediumDate(date)}
    </span>
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
  const payment = isDraft
    ? null
    : debt.paymentKind === "fixed"
      ? moneyTrim(debt.fixedPayment ?? 0)
      : projected && projected.estimatedMinimum > 0
        ? moneyTrim(projected.estimatedMinimum)
        : null;
  const available =
    debt.creditLimit !== null
      ? moneyTrim(Math.max(0, debt.creditLimit - debt.balance))
      : null;
  const payoff = isDraft
    ? "Not in plan"
    : projected?.paidOffDate
      ? `Payoff ${mediumDate(projected.paidOffDate)}`
      : "Over 5 years";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className={`flex min-w-0 cursor-pointer items-start justify-between gap-2 overflow-hidden rounded-lg border border-line bg-surface-2 px-2.5 py-2 transition hover:bg-surface-3 ${
        isDraft ? "opacity-70" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="text-xs font-medium text-ink">{debt.name}</span>
          <span className="text-xs font-semibold tabular-nums text-warning-strong">
            {moneyTrim(debt.balance)}
          </span>
          <span className="text-[0.625rem] tabular-nums text-ink-faint">{percent(debt.apr)}</span>
          <span className="text-[0.625rem] text-ink-faint">
            {debt.debtType === "loan" ? "Loan" : "Card"}
          </span>
          {isDraft && (
            <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
              Draft
            </span>
          )}
          {debt.noExtraPayoff && (
            <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
              No extra
            </span>
          )}
          {debt.promos.map((promo) => (
            <span
              key={promo.id}
              className={`max-w-full truncate rounded-pill border px-1.5 py-px text-[0.625rem] font-medium ${
                promo.kind === "deferred_interest"
                  ? "border-warning bg-warning-soft text-warning-strong"
                  : "border-info bg-info-soft text-info-strong"
              }`}
              title={`${PROMO_LABELS[promo.kind]} at ${percent(promo.apr)} until ${mediumDate(promo.endDate)}`}
            >
              {percent(promo.apr)} {promoShortKind(promo.kind)} → {shortDate(promo.endDate)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-ink">
            {shortDate(debt.dueDate || debt.startDate)}
          </span>
          <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
            {CADENCE_LABELS[debt.cadence] ?? debt.cadence}
          </span>
          {debt.startDate && (
            <ActiveSince date={debt.startDate} active={!isDraft} />
          )}
          {debt.endDate && (
            <span className="text-[0.625rem] text-ink-faint">
              until {mediumDate(debt.endDate)}
            </span>
          )}
          {payment && (
            <span className="text-[0.625rem] text-ink-muted">
              {debt.paymentKind === "fixed" ? `${payment}` : `Est. ${payment}`}
            </span>
          )}
          {available && (
            <span className="text-[0.625rem] text-ink-muted">{available} left</span>
          )}
          <span className="text-[0.625rem] text-ink-faint">{payoff}</span>
        </div>
      </div>

      <div
        className="shrink-0"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <RowActions
          name={debt.name}
          status={debt.status ?? "active"}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
          busy={busy}
        />
      </div>
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
            role="button"
            tabIndex={0}
            onClick={() => onEdit(event)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();
                onEdit(event);
              }
            }}
            className={`flex min-w-0 cursor-pointer items-start justify-between gap-2 overflow-hidden rounded-lg border border-line bg-surface-2 px-2.5 py-2 transition hover:bg-surface-3 ${
              isDraft ? "opacity-70" : ""
            }`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <span className="text-xs font-medium text-ink">{event.name}</span>
                <span
                  className={
                    event.direction === "gain"
                      ? "text-xs font-semibold tabular-nums text-success-strong"
                      : "text-xs font-semibold tabular-nums text-danger-strong"
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
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-ink">
                  {shortDate(event.dueDate || event.startDate)}
                </span>
                <span className="rounded-pill border border-line bg-surface-1 px-1.5 py-px text-[0.625rem] font-medium text-ink-muted">
                  {CADENCE_LABELS[event.cadence] ?? event.cadence}
                </span>
                <ActiveSince date={event.startDate} active={!isDraft} />
                {event.endDate && (
                  <span className="text-[0.625rem] text-ink-faint">
                    until {mediumDate(event.endDate)}
                  </span>
                )}
                {event.direction === "charge" && (
                  <span className="text-[0.625rem] text-ink-muted">
                    Paid by {paidByReason(event, debtName(event.paymentDebtId))}
                  </span>
                )}
              </div>
            </div>

            <div
              className="shrink-0"
              onClick={(click) => click.stopPropagation()}
              onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
            >
              <RowActions
                name={event.name}
                status={event.status ?? "active"}
                onEdit={() => onEdit(event)}
                onStatus={(status) => onStatus(event, status)}
                onDelete={() => onDelete(event)}
                busy={busy}
              />
            </div>
          </div>
        );
      })}
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

function SetupSection({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-line bg-surface-1 px-3.5 py-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <h2 className="text-xs font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function CashGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold text-ink-muted">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function AddButton({
  onClick,
  label,
  tone = "brand",
}: {
  onClick: () => void;
  label: string;
  tone?: "brand" | "danger" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-danger-soft text-danger-strong hover:bg-[#fecaca]"
      : tone === "warning"
        ? "bg-warning-soft text-warning-strong hover:bg-[#fde68a]"
        : "bg-brand-soft text-brand hover:bg-[#c8e9cc]";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${toneClass}`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

function paidByReason(event: CashEvent, cardName: string): string {
  if (event.paymentMethod === "optimizer") return "the plan";
  if (event.paymentMethod === "card") {
    return event.locked ? `${cardName} (pinned)` : cardName;
  }
  return "cash";
}

function promoShortKind(kind: string): string {
  if (kind === "purchase") return "new";
  if (kind === "existing_balance") return "existing";
  return "deferred";
}

function PlanOptions() {
  const { save, saving } = usePlan();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative flex justify-center pt-4 pb-2">
      {open && (
        <div className="absolute bottom-full mb-2 w-56 overflow-hidden rounded-lg border border-line bg-surface-1 py-1 shadow-elev-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setOpen(false);
              void save((planWindow) => loadDemoPlan(planWindow));
            }}
            className="flex w-full px-3 py-2 text-left text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Replace with sample
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!window.confirm("Delete every debt, gain and charge? This cannot be undone.")) {
                return;
              }
              setOpen(false);
              void save((planWindow) => clearPlan(planWindow));
            }}
            className="flex w-full px-3 py-2 text-left text-xs font-medium text-danger-strong hover:bg-danger-soft disabled:opacity-50"
          >
            Reset plan
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label="Plan options"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-pill border transition ${
          open
            ? "border-brand bg-brand-soft text-brand"
            : "border-line bg-surface-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
        }`}
      >
        <Settings className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.6875rem] text-ink-muted">{children}</p>;
}
