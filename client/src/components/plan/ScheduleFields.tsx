/**
 * Start date, cadence, due date, optional end — the same schedule debts and
 * cash events share. Start is when the item becomes active. Due date is an
 * example hit (the 12th, that Wednesday, January 1) that the cadence copies.
 */

import { Repeat } from "lucide-react";

import { CADENCE_LABELS } from "@/lib/format";
import type { Cadence } from "@/lib/planApi";
import { BadgeSelect, Field, TextInput } from "./fields";

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
    <div className="flex flex-wrap items-end gap-2">
      <Field
        label="Start"
        error={err("startDate")}
        className="w-full min-w-0 sm:w-[9.75rem]"
        as="div"
        help={{
          title: "Start date",
          text: "When this is truly active. Nothing hits before this day. Start and due can be the same date.",
        }}
      >
        <TextInput
          type="date"
          value={draft.startDate}
          onChange={(event) => set("startDate", event.target.value)}
          invalid={!!err("startDate")}
        />
      </Field>

      <Field label="Repeats" error={err("cadence")} as="div">
        <BadgeSelect
          value={draft.cadence}
          onChange={(value) => set("cadence", value)}
          invalid={!!err("cadence")}
          icon={<Repeat className="h-3 w-3 text-ink-faint" strokeWidth={2} aria-hidden />}
          options={Object.entries(CADENCE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </Field>

      <Field
        label={oneTime ? "On" : "Due"}
        error={err("dueDate")}
        className="w-full min-w-0 sm:w-[9.75rem]"
        as="div"
        help={{
          title: oneTime ? "On this day" : "Due date",
          text: oneTime
            ? "The day this actually lands. Can be the same as start."
            : "The first actual charge or gain date. Later copies go forward from here. Can be the same as start.",
        }}
      >
        <TextInput
          type="date"
          value={draft.dueDate}
          onChange={(event) => set("dueDate", event.target.value)}
          invalid={!!err("dueDate")}
        />
      </Field>

      {!oneTime && (
        <Field label="Stops" error={err("endDate")} className="w-full min-w-0 sm:w-[9.75rem]">
          <TextInput
            type="date"
            value={draft.endDate}
            onChange={(event) => set("endDate", event.target.value)}
            invalid={!!err("endDate")}
          />
        </Field>
      )}
    </div>
  );
}
