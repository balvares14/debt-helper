/**
 * Add or edit a gain or a charge.
 *
 * Only spending gets routing controls — money coming in always lands in cash.
 * Cards offered as a payment method are filtered to ones that can actually
 * take a charge, so a car loan never appears as a way to pay for groceries.
 */

import { useMemo, useState, type FormEvent } from "react";

import {
  BadgeToggle,
  Checkbox,
  Field,
  FormActions,
  NumberInput,
  Select,
  StatusBadge,
  TextInput,
} from "./fields";
import { fieldError, usePlan } from "@/contexts/PlanContext";
import { ScheduleFields } from "./ScheduleFields";
import {
  createCashEvent,
  updateCashEvent,
  type Cadence,
  type CashEvent,
  type CashEventInput,
  type Direction,
  type ItemStatus,
  type PaymentMethod,
} from "@/lib/planApi";

interface Draft {
  name: string;
  amount: string;
  direction: Direction;
  startDate: string;
  cadence: Cadence;
  dueDate: string;
  endDate: string;
  canPutOnCard: boolean;
  paymentMethod: PaymentMethod;
  paymentDebtId: string;
  locked: boolean;
  status: ItemStatus;
}

const emptyDraft = (direction: Direction, today: string): Draft => ({
  name: "",
  amount: "",
  direction,
  startDate: today,
  cadence: direction === "gain" ? "biweekly" : "monthly",
  dueDate: today,
  endDate: "",
  canPutOnCard: false,
  paymentMethod: "cash",
  paymentDebtId: "",
  locked: false,
  status: "draft",
});

const toDraft = (event: CashEvent): Draft => ({
  name: event.name,
  amount: String(event.amount),
  direction: event.direction,
  startDate: event.startDate,
  cadence: event.cadence,
  dueDate: event.dueDate ?? event.startDate,
  endDate: event.endDate ?? "",
  canPutOnCard: event.canPutOnCard,
  paymentMethod: event.paymentMethod,
  paymentDebtId: event.paymentDebtId === null ? "" : String(event.paymentDebtId),
  locked: event.locked,
  status: event.status ?? "active",
});

export interface CashEventFormProps {
  event?: CashEvent;
  /** Which kind to create when adding. Ignored when editing. */
  direction?: Direction;
  onDone: () => void;
  /** Seed a new event on this day (ignored when editing). */
  initialDate?: string;
  /** Drop the card chrome when the form already sits in a panel. */
  plain?: boolean;
}

export default function CashEventForm({
  event,
  direction = "charge",
  onDone,
  initialDate,
  plain = false,
}: CashEventFormProps) {
  const { plan, save, saving, fieldErrors, error, today } = usePlan();
  const [draft, setDraft] = useState<Draft>(() =>
    event ? toDraft(event) : emptyDraft(direction, initialDate || today),
  );

  const cards = useMemo(
    () =>
      (plan?.debts ?? []).filter(
        (debt) =>
          debt.acceptsNewCharges &&
          (debt.status !== "draft" || String(debt.id) === draft.paymentDebtId),
      ),
    [plan, draft.paymentDebtId],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const localErrors = useMemo(() => cashEventErrors(draft), [draft]);
  const ready = localErrors.length === 0;
  const status = ready ? draft.status : "draft";

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!ready) return;

    const isCharge = draft.direction === "charge";
    const input: CashEventInput = {
      name: draft.name,
      amount: draft.amount || 0,
      direction: draft.direction,
      startDate: draft.startDate,
      cadence: draft.cadence,
      dueDate: draft.dueDate,
      endDate: draft.cadence === "one_time" || !draft.endDate ? null : draft.endDate,
      canPutOnCard: isCharge && draft.canPutOnCard,
      paymentMethod: isCharge ? draft.paymentMethod : "cash",
      paymentDebtId:
        isCharge && draft.paymentMethod === "card" && draft.paymentDebtId
          ? Number(draft.paymentDebtId)
          : null,
      locked: isCharge && draft.locked,
      status,
    };

    const ok = await save((planWindow) =>
      event ? updateCashEvent(event.id, input, planWindow) : createCashEvent(input, planWindow),
    );
    if (ok) onDone();
  };

  const err = (field: string) => fieldError(fieldErrors, field);
  const isCharge = draft.direction === "charge";

  return (
    <form
      onSubmit={handleSubmit}
      className={
        plain
          ? "flex flex-col gap-3"
          : "flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-3"
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Name" error={err("name")} className="min-w-0 flex-1 basis-[10rem]">
          <TextInput
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={isCharge ? "Rent" : "Paycheck or Initial cash"}
            invalid={!!err("name")}
            autoFocus
          />
        </Field>

        <Field label="Amount" error={err("amount")} className="w-24">
          <NumberInput
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            invalid={!!err("amount")}
          />
        </Field>

        <Field label="Direction" error={err("direction")} as="div">
          <BadgeToggle
            value={draft.direction}
            onChange={(next) =>
              setDraft((current) => ({
                ...current,
                direction: next,
                canPutOnCard: next === "gain" ? false : current.canPutOnCard,
                paymentMethod: next === "gain" ? "cash" : current.paymentMethod,
                paymentDebtId: next === "gain" ? "" : current.paymentDebtId,
                locked: next === "gain" ? false : current.locked,
              }))
            }
            options={[
              { value: "gain", label: "Gain" },
              { value: "charge", label: "Charge", tone: "danger" },
            ]}
          />
        </Field>

        <Field label="Status" error={err("status")} as="div">
          <StatusBadge
            value={status}
            onChange={(next) => set("status", next)}
            disabled={!ready}
            title={
              ready
                ? undefined
                : "Fill name, amount, start, and due before this can be Active. Stops is optional."
            }
          />
        </Field>
      </div>

      <ScheduleFields
        draft={draft}
        set={(key, value) => set(key, value as never)}
        err={err}
      />

      {isCharge && (
        <div className="flex flex-col gap-2 rounded-xs border border-line bg-surface-1 p-2.5">
          <p className="text-[0.6875rem] font-medium text-ink-muted">How this gets paid</p>

          <Checkbox
            label="This could go on a credit card"
            hint="True for groceries and fuel; false for rent and anything card-hostile."
            checked={draft.canPutOnCard}
            onChange={(next) =>
              setDraft((current) => ({
                ...current,
                canPutOnCard: next,
                // "Let the optimizer decide" is not a real option for spend a
                // card cannot absorb, so fall back to cash.
                paymentMethod:
                  !next && current.paymentMethod !== "cash" ? "cash" : current.paymentMethod,
              }))
            }
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Payment method" error={err("paymentMethod")}>
              <Select
                value={draft.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value as PaymentMethod)}
              >
                <option value="cash">Cash</option>
                <option value="card" disabled={cards.length === 0}>
                  A specific card
                </option>
                <option value="optimizer" disabled={!draft.canPutOnCard}>
                  Let the plan decide
                </option>
              </Select>
            </Field>

            {draft.paymentMethod === "card" && (
              <Field
                label="Card"
                hint="Only cards that can take new charges are listed."
                error={err("paymentDebtId")}
              >
                <Select
                  value={draft.paymentDebtId}
                  onChange={(e) => set("paymentDebtId", e.target.value)}
                  invalid={!!err("paymentDebtId")}
                >
                  <option value="">Choose a card…</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                      {card.status === "draft" ? " (draft)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {draft.paymentMethod === "card" && (
            <Checkbox
              label="Keep this pinned"
              hint="The plan will not move it, even if another card would cost less."
              checked={draft.locked}
              onChange={(next) => set("locked", next)}
            />
          )}

          {draft.paymentMethod === "optimizer" && (
            <p className="text-[0.625rem] leading-relaxed text-ink-faint">
              Each time this occurs, the plan picks cash or a card. It only uses a card when the
              spend genuinely floats free — a 0% purchase window, or a card you pay in full — or
              when paying cash would overdraw the account.
            </p>
          )}
        </div>
      )}

      {error && fieldErrors.length === 0 && (
        <p className="text-[0.6875rem] text-danger-strong">{error}</p>
      )}

      <FormActions
        saving={saving}
        disabled={!ready}
        submitLabel={event ? "Save changes" : isCharge ? "Add charge" : "Add gain"}
        onCancel={onDone}
      />
      {!ready && (
        <p className="text-[0.625rem] text-ink-faint">
          Name, amount, start, and due are required. Stops is optional. This stays Draft until then.
        </p>
      )}
    </form>
  );
}

function cashEventErrors(draft: Draft): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  if (!draft.name.trim()) errors.push({ field: "name", message: "Give this a name." });
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Amount must be more than $0." });
  }
  if (!draft.startDate) errors.push({ field: "startDate", message: "Needs a start date." });
  if (!draft.dueDate) errors.push({ field: "dueDate", message: "Needs a due date." });
  if (draft.direction === "charge" && draft.paymentMethod === "card" && !draft.paymentDebtId) {
    errors.push({ field: "paymentDebtId", message: "Pick a card to pin this charge to." });
  }
  return errors;
}
