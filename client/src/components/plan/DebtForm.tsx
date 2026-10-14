/**
 * Add or edit one debt.
 *
 * The form adapts to the type rather than showing every field at once: a loan
 * asks for its contract payment and cannot take charges, a card asks for a
 * limit and defaults to an estimated minimum so the user is not retyping the
 * issuer's number every month.
 */

import { useState, type FormEvent } from "react";

import { Checkbox, Field, FormActions, NumberInput, Select, TextInput } from "./fields";
import { fieldError, usePlan } from "@/contexts/PlanContext";
import { PROMO_LABELS } from "@/lib/format";
import {
  createDebt,
  updateDebt,
  type Debt,
  type DebtInput,
  type DebtType,
  type ItemStatus,
  type PaymentKind,
  type PromoKind,
} from "@/lib/planApi";

interface PromoDraft {
  kind: PromoKind;
  apr: string;
  appliesToAmount: string;
  endDate: string;
}

interface Draft {
  name: string;
  debtType: DebtType;
  balance: string;
  apr: string;
  dueDay: string;
  paymentKind: PaymentKind;
  fixedPayment: string;
  overrideMin: string;
  acceptsNewCharges: boolean;
  creditLimit: string;
  annualFee: string;
  annualFeeMonth: string;
  carryingBalance: boolean;
  notes: string;
  status: ItemStatus;
  promos: PromoDraft[];
}

const emptyDraft = (): Draft => ({
  name: "",
  debtType: "credit_card",
  balance: "",
  apr: "",
  dueDay: "1",
  paymentKind: "estimated_min",
  fixedPayment: "",
  overrideMin: "",
  acceptsNewCharges: true,
  creditLimit: "",
  annualFee: "",
  annualFeeMonth: "1",
  carryingBalance: true,
  notes: "",
  status: "active",
  promos: [],
});

const toDraft = (debt: Debt): Draft => ({
  name: debt.name,
  debtType: debt.debtType,
  balance: String(debt.balance),
  apr: String(debt.apr),
  dueDay: String(debt.dueDay),
  paymentKind: debt.paymentKind,
  fixedPayment: debt.fixedPayment === null ? "" : String(debt.fixedPayment),
  overrideMin: debt.overrideMin === null ? "" : String(debt.overrideMin),
  acceptsNewCharges: debt.acceptsNewCharges,
  creditLimit: debt.creditLimit === null ? "" : String(debt.creditLimit),
  annualFee: debt.annualFee ? String(debt.annualFee) : "",
  annualFeeMonth: debt.annualFeeMonth ? String(debt.annualFeeMonth) : "1",
  carryingBalance: debt.carryingBalance,
  notes: debt.notes ?? "",
  status: debt.status ?? "active",
  promos: debt.promos.map((promo) => ({
    kind: promo.kind,
    apr: String(promo.apr),
    appliesToAmount: promo.appliesToAmount === null ? "" : String(promo.appliesToAmount),
    endDate: promo.endDate,
  })),
});

export interface DebtFormProps {
  debt?: Debt;
  onDone: () => void;
}

export default function DebtForm({ debt, onDone }: DebtFormProps) {
  const { save, saving, fieldErrors, error } = usePlan();
  const [draft, setDraft] = useState<Draft>(() => (debt ? toDraft(debt) : emptyDraft()));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /** Switching type moves the defaults with it, so a loan is never left
   *  holding card-shaped settings. */
  const setType = (debtType: DebtType) => {
    setDraft((current) => ({
      ...current,
      debtType,
      paymentKind: debtType === "loan" ? "fixed" : "estimated_min",
      acceptsNewCharges: debtType === "credit_card",
      carryingBalance: debtType === "loan" ? true : current.carryingBalance,
      promos: debtType === "loan" ? [] : current.promos,
    }));
  };

  const addPromo = (kind: PromoKind) =>
    setDraft((current) => ({
      ...current,
      promos: [...current.promos, { kind, apr: "0", appliesToAmount: "", endDate: "" }],
    }));

  const updatePromo = (index: number, patch: Partial<PromoDraft>) =>
    setDraft((current) => ({
      ...current,
      promos: current.promos.map((promo, i) => (i === index ? { ...promo, ...patch } : promo)),
    }));

  const removePromo = (index: number) =>
    setDraft((current) => ({
      ...current,
      promos: current.promos.filter((_, i) => i !== index),
    }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const input: DebtInput = {
      name: draft.name,
      debtType: draft.debtType,
      balance: draft.balance || 0,
      apr: draft.apr || 0,
      dueDay: draft.dueDay || 1,
      paymentKind: draft.paymentKind,
      fixedPayment: draft.paymentKind === "fixed" ? draft.fixedPayment : null,
      overrideMin: draft.paymentKind === "override_min" ? draft.overrideMin : null,
      acceptsNewCharges: draft.debtType === "loan" ? false : draft.acceptsNewCharges,
      creditLimit: draft.creditLimit || null,
      annualFee: draft.annualFee || 0,
      annualFeeMonth: draft.annualFee ? draft.annualFeeMonth : null,
      carryingBalance: draft.debtType === "loan" ? true : draft.carryingBalance,
      notes: draft.notes || null,
      status: draft.status,
      // Always sent, so clearing the last promo actually clears it.
      promos: draft.promos
        .filter((promo) => promo.endDate)
        .map((promo) => ({
          kind: promo.kind,
          apr: promo.apr || 0,
          appliesToAmount:
            promo.kind === "purchase" || !promo.appliesToAmount ? null : promo.appliesToAmount,
          endDate: promo.endDate,
        })),
    };

    const ok = await save((planWindow) =>
      debt ? updateDebt(debt.id, input, planWindow) : createDebt(input, planWindow),
    );
    if (ok) onDone();
  };

  const err = (field: string) => fieldError(fieldErrors, field);
  const isCard = draft.debtType === "credit_card";
  const usedPromoKinds = new Set(draft.promos.map((promo) => promo.kind));

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" error={err("name")} className="sm:col-span-2 lg:col-span-1">
          <TextInput
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Chase Freedom"
            invalid={!!err("name")}
            autoFocus
          />
        </Field>

        <Field label="Type" error={err("debtType")}>
          <Select
            value={draft.debtType}
            onChange={(event) => setType(event.target.value as DebtType)}
          >
            <option value="credit_card">Credit card / line</option>
            <option value="loan">Loan (fixed payment)</option>
          </Select>
        </Field>

        <Field
          label="Status"
          hint="Draft stays saved but is left out of the plan."
          error={err("status")}
        >
          <Select
            value={draft.status}
            onChange={(event) => set("status", event.target.value as ItemStatus)}
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>

        <Field label="Balance owed" error={err("balance")}>
          <NumberInput
            value={draft.balance}
            onChange={(event) => set("balance", event.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            invalid={!!err("balance")}
          />
        </Field>

        <Field
          label="APR %"
          hint={isCard ? "The standard rate after any promo ends." : undefined}
          error={err("apr")}
        >
          <NumberInput
            value={draft.apr}
            onChange={(event) => set("apr", event.target.value)}
            placeholder="24.99"
            min="0"
            max="100"
            step="0.01"
            invalid={!!err("apr")}
          />
        </Field>

        <Field label="Due day" hint="Day of the month, 1-28." error={err("dueDay")}>
          <NumberInput
            value={draft.dueDay}
            onChange={(event) => set("dueDay", event.target.value)}
            min="1"
            max="28"
            step="1"
            invalid={!!err("dueDay")}
          />
        </Field>

        <Field label="Required payment" error={err("paymentKind")}>
          <Select
            value={draft.paymentKind}
            onChange={(event) => set("paymentKind", event.target.value as PaymentKind)}
          >
            {isCard && <option value="estimated_min">Estimate it each month</option>}
            <option value="fixed">Fixed amount</option>
            {isCard && <option value="override_min">Use my statement minimum</option>}
          </Select>
        </Field>

        {draft.paymentKind === "fixed" && (
          <Field
            label="Payment amount"
            hint="The contract payment. It does not change with the balance."
            error={err("fixedPayment")}
          >
            <NumberInput
              value={draft.fixedPayment}
              onChange={(event) => set("fixedPayment", event.target.value)}
              placeholder="310.00"
              min="0"
              step="0.01"
              invalid={!!err("fixedPayment")}
            />
          </Field>
        )}

        {draft.paymentKind === "override_min" && (
          <Field
            label="Statement minimum"
            hint="Used for this cycle only, then estimated again."
            error={err("overrideMin")}
          >
            <NumberInput
              value={draft.overrideMin}
              onChange={(event) => set("overrideMin", event.target.value)}
              placeholder="45.00"
              min="0"
              step="0.01"
              invalid={!!err("overrideMin")}
            />
          </Field>
        )}

        {isCard && (
          <Field
            label="Credit limit"
            hint="Needed to know how much room is left."
            error={err("creditLimit")}
          >
            <NumberInput
              value={draft.creditLimit}
              onChange={(event) => set("creditLimit", event.target.value)}
              placeholder="8000"
              min="0"
              step="0.01"
              invalid={!!err("creditLimit")}
            />
          </Field>
        )}

        <Field label="Annual fee" hint="Leave blank if none." error={err("annualFee")}>
          <NumberInput
            value={draft.annualFee}
            onChange={(event) => set("annualFee", event.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            invalid={!!err("annualFee")}
          />
        </Field>

        {!!draft.annualFee && Number(draft.annualFee) > 0 && (
          <Field label="Fee charged in" error={err("annualFeeMonth")}>
            <Select
              value={draft.annualFeeMonth}
              onChange={(event) => set("annualFeeMonth", event.target.value)}
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December",
              ].map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {isCard && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox
            label="This card can take new charges"
            hint="Turn off for a closed or maxed card. Charges pinned here are released."
            checked={draft.acceptsNewCharges}
            onChange={(next) => set("acceptsNewCharges", next)}
          />
          <Checkbox
            label="I carry a balance on this card"
            hint="Off means you pay the statement in full, so purchases never accrue interest."
            checked={draft.carryingBalance}
            onChange={(next) => set("carryingBalance", next)}
          />
        </div>
      )}

      {isCard && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] font-medium text-ink-muted">
              Promotional rates
            </span>
            {(["purchase", "existing_balance", "deferred_interest"] as PromoKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={usedPromoKinds.has(kind) || draft.promos.length >= 2}
                onClick={() => addPromo(kind)}
                className="rounded-pill border border-line bg-surface-1 px-2 py-0.5 text-[0.625rem] font-medium text-ink-muted hover:bg-surface-3 disabled:opacity-40"
              >
                + {PROMO_LABELS[kind]}
              </button>
            ))}
          </div>

          {err("promos") && (
            <p className="text-[0.625rem] text-danger-strong">{err("promos")}</p>
          )}

          {draft.promos.map((promo, index) => (
            <div
              key={`${promo.kind}-${index}`}
              className="grid gap-2 rounded-xs border border-line bg-surface-1 p-2 sm:grid-cols-4"
            >
              <Field label="Applies to" hint={promoHint(promo.kind)}>
                <TextInput value={PROMO_LABELS[promo.kind]} disabled readOnly />
              </Field>

              <Field label="Promo APR %" error={err(`promos[${index}].apr`)}>
                <NumberInput
                  value={promo.apr}
                  onChange={(event) => updatePromo(index, { apr: event.target.value })}
                  min="0"
                  max="100"
                  step="0.01"
                  invalid={!!err(`promos[${index}].apr`)}
                />
              </Field>

              {promo.kind === "purchase" ? (
                <Field label="Amount" hint="Covers all new spend while open.">
                  <TextInput value="All new purchases" disabled readOnly />
                </Field>
              ) : (
                <Field
                  label="Amount at this rate"
                  hint="Blank means the whole balance."
                  error={err(`promos[${index}].appliesToAmount`)}
                >
                  <NumberInput
                    value={promo.appliesToAmount}
                    onChange={(event) =>
                      updatePromo(index, { appliesToAmount: event.target.value })
                    }
                    placeholder="Whole balance"
                    min="0"
                    step="0.01"
                    invalid={!!err(`promos[${index}].appliesToAmount`)}
                  />
                </Field>
              )}

              <div className="flex items-end gap-2">
                <Field
                  label="Ends"
                  error={err(`promos[${index}].endDate`)}
                  className="flex-1"
                >
                  <TextInput
                    type="date"
                    value={promo.endDate}
                    onChange={(event) => updatePromo(index, { endDate: event.target.value })}
                    invalid={!!err(`promos[${index}].endDate`)}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removePromo(index)}
                  className="mb-[1.375rem] rounded-xs border border-line px-2 py-1.5 text-[0.625rem] text-ink-muted hover:bg-surface-2"
                >
                  Remove
                </button>
              </div>

              {promo.kind === "deferred_interest" && (
                <p className="text-[0.625rem] leading-snug text-warning-strong sm:col-span-4">
                  If this is not paid to $0 by the end date, every month of interest the promo
                  held back gets charged at once. The plan will prioritise clearing it.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Field label="Notes" className="max-w-prose">
        <TextInput
          value={draft.notes}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="Optional"
        />
      </Field>

      {error && fieldErrors.length === 0 && (
        <p className="text-[0.6875rem] text-danger-strong">{error}</p>
      )}

      <FormActions
        saving={saving}
        submitLabel={debt ? "Save changes" : "Add debt"}
        onCancel={onDone}
      />
    </form>
  );
}

function promoHint(kind: PromoKind): string {
  if (kind === "purchase") return "Rate for new spend put on this card.";
  if (kind === "existing_balance") return "A slice of what you already owe, e.g. a transfer.";
  return "Pay it off in time or all the back-interest lands.";
}
