/**
 * Add or edit a gain or a charge.
 *
 * Only spending gets routing controls — money coming in always lands in cash.
 * Cards offered as a payment method are filtered to ones that can actually
 * take a charge, so a car loan never appears as a way to pay for groceries.
 */

import { useMemo, useState, type FormEvent } from "react";

import { Checkbox, Field, FormActions, NumberInput, Select, TextInput } from "./fields";
import { fieldError, usePlan } from "@/contexts/PlanContext";
import { CADENCE_LABELS } from "@/lib/format";
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
  endDate: "",
  canPutOnCard: false,
  paymentMethod: "cash",
  paymentDebtId: "",
  locked: false,
  status: "active",
});

const toDraft = (event: CashEvent): Draft => ({
  name: event.name,
  amount: String(event.amount),
  direction: event.direction,
  startDate: event.startDate,
  cadence: event.cadence,
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
}

export default function CashEventForm({ event, direction = "charge", onDone }: CashEventFormProps) {
  const { plan, save, saving, fieldErrors, error, today } = usePlan();
  const [draft, setDraft] = useState<Draft>(() =>
    event ? toDraft(event) : emptyDraft(direction, today),
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

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();

    const isCharge = draft.direction === "charge";
    const input: CashEventInput = {
      name: draft.name,
      amount: draft.amount || 0,
      direction: draft.direction,
      startDate: draft.startDate,
      cadence: draft.cadence,
      endDate: draft.cadence === "one_time" || !draft.endDate ? null : draft.endDate,
      canPutOnCard: isCharge && draft.canPutOnCard,
      paymentMethod: isCharge ? draft.paymentMethod : "cash",
      paymentDebtId:
        isCharge && draft.paymentMethod === "card" && draft.paymentDebtId
          ? Number(draft.paymentDebtId)
          : null,
      locked: isCharge && draft.locked,
      status: draft.status,
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
      className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" error={err("name")}>
          <TextInput
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={isCharge ? "Rent" : "Paycheck"}
            invalid={!!err("name")}
            autoFocus
          />
        </Field>

        <Field label="Amount" hint="Always positive." error={err("amount")}>
          <NumberInput
            value={draft.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            invalid={!!err("amount")}
          />
        </Field>

        <Field label="Direction" error={err("direction")}>
          <Select
            value={draft.direction}
            onChange={(e) => {
              const next = e.target.value as Direction;
              setDraft((current) => ({
                ...current,
                direction: next,
                // Routing is meaningless for income; reset it rather than
                // carrying a stale card pin onto a paycheck.
                canPutOnCard: next === "gain" ? false : current.canPutOnCard,
                paymentMethod: next === "gain" ? "cash" : current.paymentMethod,
                paymentDebtId: next === "gain" ? "" : current.paymentDebtId,
                locked: next === "gain" ? false : current.locked,
              }));
            }}
          >
            <option value="charge">Charge (money out)</option>
            <option value="gain">Gain (money in)</option>
          </Select>
        </Field>

        <Field
          label="Status"
          hint="Draft stays saved but is left out of the plan."
          error={err("status")}
        >
          <Select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as ItemStatus)}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>

        <Field label="Repeats" error={err("cadence")}>
          <Select value={draft.cadence} onChange={(e) => set("cadence", e.target.value as Cadence)}>
            {Object.entries(CADENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={draft.cadence === "one_time" ? "Date" : "First date"}
          hint={draft.cadence === "one_time" ? undefined : "The pattern is anchored to this day."}
          error={err("startDate")}
        >
          <TextInput
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            invalid={!!err("startDate")}
          />
        </Field>

        {draft.cadence !== "one_time" && (
          <Field label="Stops after" hint="Optional." error={err("endDate")}>
            <TextInput
              type="date"
              value={draft.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              invalid={!!err("endDate")}
            />
          </Field>
        )}
      </div>

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
        submitLabel={event ? "Save changes" : isCharge ? "Add charge" : "Add gain"}
        onCancel={onDone}
      />
    </form>
  );
}
