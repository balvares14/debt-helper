/**
 * Start date, cadence, due date, optional end — the same schedule debts and
 * cash events share. Start is when the item becomes active. Due date is an
 * example hit (the 12th, that Wednesday, January 1) that the cadence copies.
 */

import { CADENCE_LABELS } from "@/lib/format";
import type { Cadence } from "@/lib/planApi";
import { Field, Select, TextInput } from "./fields";

export interface ScheduleDraft {
  startDate: string;
  cadence: Cadence;
  dueDate: string;
  endDate: string;
}

export function ScheduleFields({
  draft,
  set,
  err,
}: {
  draft: ScheduleDraft;
  set: (key: keyof ScheduleDraft, value: string) => void;
  err: (field: string) => string | undefined;
}) {
  const oneTime = draft.cadence === "one_time";

  return (
    <>
      <Field
        label="Start date"
        hint="When this becomes active. Hits never land before this day."
        error={err("startDate")}
      >
        <TextInput
          type="date"
          value={draft.startDate}
          onChange={(event) => set("startDate", event.target.value)}
          invalid={!!err("startDate")}
        />
      </Field>

      <Field label="Repeats" error={err("cadence")}>
        <Select value={draft.cadence} onChange={(event) => set("cadence", event.target.value)}>
          {Object.entries(CADENCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Due date"
        hint={
          oneTime
            ? "The day this lands."
            : "The first day it is charged or gained. Later copies are counted from this date."
        }
        error={err("dueDate")}
      >
        <TextInput
          type="date"
          value={draft.dueDate}
          onChange={(event) => set("dueDate", event.target.value)}
          invalid={!!err("dueDate")}
        />
      </Field>

      {!oneTime && (
        <Field label="Stops after" hint="Optional." error={err("endDate")}>
          <TextInput
            type="date"
            value={draft.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            invalid={!!err("endDate")}
          />
        </Field>
      )}
    </>
  );
}
