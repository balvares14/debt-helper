/**
 * Holds the plan and is the only place it changes.
 *
 * Because the server recalculates everything on every write and returns the
 * whole plan, there is no client-side model to keep in sync — a mutation
 * swaps the plan wholesale. That is what makes "every edit recalculates the
 * schedule, routing and banners" true rather than aspirational.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { errorMessage } from "@/lib/api";
import { useToast } from "@/shell/Toast";
import {
  addMonthsISO,
  endOfMonthISO,
  localToday,
  startOfMonthISO,
} from "@/lib/format";
import {
  fetchPlan,
  type FieldError,
  type Plan,
  type PlanEnvelope,
  type PlanWindow,
  type ProjectedDay,
} from "@/lib/planApi";

/** One month behind today, so the calendar can page back without a refetch. */
const DETAIL_BACK_MONTHS = 1;
/** Matches the server's max horizon. First load asks for all of it so month
 *  changes and the plan charts reuse one calculation instead of asking again. */
const DETAIL_FORWARD_MONTHS = 60;

const windowFor = (today: string, horizonMonths = DETAIL_FORWARD_MONTHS): PlanWindow => {
  const month = startOfMonthISO(today);
  return {
    today,
    from: startOfMonthISO(addMonthsISO(month, -DETAIL_BACK_MONTHS)),
    to: endOfMonthISO(addMonthsISO(month, horizonMonths)),
  };
};

export interface PlanContextValue {
  plan: Plan | null;
  loading: boolean;
  saving: boolean;
  /** Load or save failure, already turned into something readable. */
  error: string | null;
  /** Per-field validation messages from the last rejected write. */
  fieldErrors: FieldError[];
  clearErrors: () => void;

  today: string;
  /** First day of the month the calendar is showing. */
  visibleMonth: string;
  goToMonth: (iso: string) => void;
  shiftMonth: (delta: number) => void;

  /** The projected day for a date, if it falls in the loaded window. */
  dayFor: (iso: string) => ProjectedDay | undefined;

  reload: () => Promise<void>;
  /**
   * Runs a write and adopts the plan it returns.
   * Resolves true on success; on failure it populates `error`/`fieldErrors`
   * and resolves false, so callers can keep a form open.
   */
  save: (
    operation: (planWindow: PlanWindow) => Promise<PlanEnvelope>,
    options?: { silent?: boolean },
  ) => Promise<boolean>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export const usePlan = (): PlanContextValue => {
  const context = useContext(PlanContext);
  if (!context) throw new Error("usePlan must be used within a PlanProvider");
  return context;
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  // Captured once so a session open past midnight does not silently re-anchor
  // the calendar mid-interaction.
  const [today] = useState(localToday);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonthISO(localToday()));

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);

  // The window the current `plan.projection.days` actually covers.
  const loadedWindow = useRef<PlanWindow | null>(null);
  // Guards against a slow earlier response overwriting a newer one.
  const requestId = useRef(0);

  const load = useCallback(
    async (target: PlanWindow, showSpinner: boolean) => {
      const id = ++requestId.current;
      if (showSpinner) setLoading(true);

      try {
        const envelope = await fetchPlan(target);
        if (id !== requestId.current) return;

        if (envelope.success && envelope.data) {
          setPlan(envelope.data);
          // Trust the days the server actually sent, not the window we asked for.
          loadedWindow.current = {
            today: target.today,
            from: envelope.data.projection.window.from,
            to: envelope.data.projection.window.to,
          };
          setError(null);
        } else {
          setError(envelope.message ?? "Could not load your plan.");
        }
      } catch (caught) {
        if (id === requestId.current) setError(errorMessage(caught));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(windowFor(today), true);
  }, [load, today]);

  /**
   * Moves the calendar. Days for the whole horizon are already in memory, so
   * this is only a refetch if someone pages past what the plan actually covers.
   */
  const goToMonth = useCallback(
    (iso: string) => {
      const month = startOfMonthISO(iso);
      setVisibleMonth(month);

      const loaded = loadedWindow.current;
      const monthEnd = endOfMonthISO(month);
      if (loaded && month >= loaded.from && monthEnd <= loaded.to) return;

      void load(windowFor(today), false);
    },
    [load, today],
  );

  const shiftMonth = useCallback(
    (delta: number) => goToMonth(addMonthsISO(visibleMonth, delta)),
    [goToMonth, visibleMonth],
  );

  const reload = useCallback(() => load(windowFor(today), false), [load, today]);

  const save = useCallback<PlanContextValue["save"]>(
    async (operation, options = {}) => {
      setSaving(true);
      setError(null);
      setFieldErrors([]);

      const target = windowFor(today);

      try {
        const envelope = await operation(target);

        if (envelope.success && envelope.data) {
          // A write returns the recalculated plan, so this is the whole update.
          setPlan(envelope.data);
          loadedWindow.current = {
            today: target.today,
            from: envelope.data.projection.window.from,
            to: envelope.data.projection.window.to,
          };
          requestId.current += 1; // any in-flight read is now stale
          if (!options.silent && envelope.message) toast(envelope.message);
          return true;
        }

        setError(envelope.message ?? "That did not save.");
        setFieldErrors(envelope.errors ?? []);
        return false;
      } catch (caught) {
        // ApiError carries the server's envelope, which is where field-level
        // messages live on a 400.
        const payload = (caught as { payload?: PlanEnvelope }).payload;
        setError(errorMessage(caught));
        setFieldErrors(payload?.errors ?? []);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [today, visibleMonth, toast],
  );

  const daysByDate = useMemo(() => {
    const map = new Map<string, ProjectedDay>();
    for (const day of plan?.projection.days ?? []) map.set(day.date, day);
    return map;
  }, [plan]);

  const dayFor = useCallback((iso: string) => daysByDate.get(iso), [daysByDate]);

  const clearErrors = useCallback(() => {
    setError(null);
    setFieldErrors([]);
  }, []);

  const value = useMemo<PlanContextValue>(
    () => ({
      plan,
      loading,
      saving,
      error,
      fieldErrors,
      clearErrors,
      today,
      visibleMonth,
      goToMonth,
      shiftMonth,
      dayFor,
      reload,
      save,
    }),
    [
      plan,
      loading,
      saving,
      error,
      fieldErrors,
      clearErrors,
      today,
      visibleMonth,
      goToMonth,
      shiftMonth,
      dayFor,
      reload,
      save,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** Looks up a field message from the last rejected write. */
export function fieldError(errors: FieldError[], field: string): string | undefined {
  return errors.find((entry) => entry.field === field)?.message;
}
