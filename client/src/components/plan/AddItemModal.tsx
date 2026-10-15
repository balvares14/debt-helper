/**
 * Pick what to add on a calendar day, then reuse the Setup forms.
 */

import { useEffect, useState } from "react";

import CashEventForm from "./CashEventForm";
import DebtForm from "./DebtForm";
import { longDate } from "@/lib/format";
import { usePlan } from "@/contexts/PlanContext";
import type { DebtType, Direction } from "@/lib/planApi";

type Choice =
  | { kind: "debt"; debtType: DebtType }
  | { kind: "event"; direction: Direction };

export interface AddItemModalProps {
  open: boolean;
  date: string;
  onClose: () => void;
}

const CHOICES: Array<{
  choice: Choice;
  title: string;
  detail: string;
}> = [
  {
    choice: { kind: "debt", debtType: "credit_card" },
    title: "Credit card",
    detail: "Revolving balance, APR, limit, and optional 0% promos.",
  },
  {
    choice: { kind: "debt", debtType: "loan" },
    title: "Loan",
    detail: "A fixed contract payment that extras can still pay down.",
  },
  {
    choice: { kind: "event", direction: "gain" },
    title: "Money in",
    detail: "Paycheck, Initial cash, or any other gain on this day.",
  },
  {
    choice: { kind: "event", direction: "charge" },
    title: "Money out",
    detail: "Rent, groceries, or other spending — cash or a card.",
  },
];

export default function AddItemModal({ open, date, onClose }: AddItemModalProps) {
  const { clearErrors } = usePlan();
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    if (!open) {
      setChoice(null);
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (choice) setChoice(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, choice, onClose]);

  if (!open) return null;

  const heading = !choice
    ? "Add to this day"
    : choice.kind === "debt"
      ? choice.debtType === "loan"
        ? "Add a loan"
        : "Add a credit card"
      : choice.direction === "gain"
        ? "Add money in"
        : "Add money out";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-stretch justify-center overflow-y-auto bg-[rgba(15,23,42,0.28)] p-0 sm:items-start sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
        className="flex min-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-surface-1 shadow-elev-3 sm:min-h-0 sm:my-4 sm:rounded-lg sm:border sm:border-line"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-line px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-item-title" className="text-[0.8125rem] font-semibold text-ink">
                {heading}
              </h2>
              <p className="mt-0.5 text-[0.6875rem] text-ink-muted">
                {longDate(date)}. Same fields as Setup — this day is the first hit.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-xs px-1.5 py-0.5 text-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:max-h-[min(36rem,calc(100vh-8rem))]">
          {!choice ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {CHOICES.map((entry) => (
                <button
                  key={entry.title}
                  type="button"
                  onClick={() => {
                    clearErrors();
                    setChoice(entry.choice);
                  }}
                  className="rounded-card border border-line bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-1"
                >
                  <span className="block text-xs font-semibold text-ink">{entry.title}</span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-snug text-ink-muted">
                    {entry.detail}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  clearErrors();
                  setChoice(null);
                }}
                className="self-start text-[0.6875rem] font-medium text-ink-muted hover:text-ink"
              >
                ← All types
              </button>
              {choice.kind === "debt" ? (
                <DebtForm
                  key={`debt-${choice.debtType}-${date}`}
                  initialDate={date}
                  initialDebtType={choice.debtType}
                  plain
                  onDone={onClose}
                />
              ) : (
                <CashEventForm
                  key={`event-${choice.direction}-${date}`}
                  direction={choice.direction}
                  initialDate={date}
                  plain
                  onDone={onClose}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
