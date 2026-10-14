/**
 * Types and calls for the debt planner API.
 *
 * Every write returns the whole recalculated plan rather than the row that
 * changed, because changing one APR can move the payoff order, the spend
 * routing and the calendar all at once. Callers replace their state with what
 * comes back instead of patching it.
 */

import { api, del, patch, post, put, type ApiEnvelope } from "@/lib/api";

export type Strategy = "optimized" | "snowball";
export type DebtType = "credit_card" | "loan";
export type PaymentKind = "fixed" | "estimated_min" | "override_min";
export type PromoKind = "purchase" | "existing_balance" | "deferred_interest";
export type Direction = "gain" | "charge";
export type Cadence =
  | "one_time"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "yearly";
export type PaymentMethod = "cash" | "card" | "optimizer";
/** Draft items stay saved but are ignored by the projection. */
export type ItemStatus = "active" | "draft";

export interface Promo {
  id: number;
  debtId: number;
  kind: PromoKind;
  apr: number;
  /** null means the promo covers the whole balance. */
  appliesToAmount: number | null;
  endDate: string;
}

export interface Debt {
  id: number;
  name: string;
  debtType: DebtType;
  balance: number;
  apr: number;
  dueDay: number;
  paymentKind: PaymentKind;
  fixedPayment: number | null;
  overrideMin: number | null;
  acceptsNewCharges: boolean;
  creditLimit: number | null;
  annualFee: number;
  annualFeeMonth: number | null;
  carryingBalance: boolean;
  notes: string | null;
  status: ItemStatus;
  promos: Promo[];
}

export interface CashEvent {
  id: number;
  name: string;
  amount: number;
  direction: Direction;
  startDate: string;
  cadence: Cadence;
  endDate: string | null;
  canPutOnCard: boolean;
  paymentMethod: PaymentMethod;
  paymentDebtId: number | null;
  locked: boolean;
  isInitialDeposit: boolean;
  status: ItemStatus;
}

export interface PlanSettings {
  cashFloor: number;
  strategy: Strategy;
  horizonMonths: number;
}

/** One thing that happened on one day, as the day panel lists it. */
export type DayItemKind =
  | "gain"
  | "charge"
  | "required_payment"
  | "extra_payment"
  | "fee"
  | "interest"
  | "back_interest";

export interface DayItem {
  kind: DayItemKind;
  name: string;
  amount: number;
  method?: "cash" | "card";
  debtId?: number | null;
  debtName?: string | null;
  pinned?: boolean;
  overLimit?: boolean;
  /** True when the engine chose cash vs card here, so the choice is worth explaining. */
  optimized?: boolean;
  aprPercent?: number;
  reason?: string;
}

export interface ProjectedDay {
  date: string;
  startCash: number;
  endCash: number;
  gains: number;
  cashCharges: number;
  cardSpend: number;
  payments: number;
  interest: number;
  net: number;
  negative: boolean;
  belowFloor: boolean;
  items: DayItem[];
}

export interface ProjectedMonth {
  monthKey: string;
  startCashCents: number;
  endCashCents: number;
  lowestCashCents: number;
  lowestCashDate: string;
  gainsCents: number;
  cashChargesCents: number;
  cardSpendCents: number;
  paymentsCents: number;
  interestCents: number;
  hasNegative: boolean;
  hasBelowFloor: boolean;
}

export interface PlanAction {
  date: string;
  kind: "extra_payment" | "route_to_card" | "route_to_cash";
  /** Charge name, or the debt being paid for extras. */
  name?: string | null;
  debtId: number | null;
  debtName?: string | null;
  title: string;
  detail: string;
  amount: number;
}

export interface Banner {
  level: "critical" | "warning" | "info";
  title: string;
  message: string;
  date?: string;
  actions?: string[];
}

export interface DebtBucket {
  kind: string;
  apr: number;
  balance: number;
  endDate: string | null;
  isDeferred: boolean;
  pendingBackInterest: number;
}

export interface DebtSeries {
  dates: string[];
  series: Array<{
    id: number;
    name: string;
    balances: number[];
  }>;
}

export interface InterestSeries {
  months: string[];
  series: Array<{
    id: number;
    name: string;
    amounts: number[];
  }>;
}

export interface ProjectedDebt {
  id: number;
  name: string;
  projectedBalance: number;
  startingBalance: number;
  effectiveApr: number;
  estimatedMinimum: number;
  availableCredit: number | null;
  interestCharged: number;
  totalPaid: number;
  newSpend: number;
  paidOffDate: string | null;
  purchaseApr: number;
  buckets: DebtBucket[];
}

export interface PlanSummary {
  cashOnHand: number;
  totalDebt: number;
  debtFreeDate: string | null;
  monthsToDebtFree: number | null;
  remainingDebtAtHorizon: number;
  interestRemaining: number;
  totalPaid: number;
  newCardSpend: number;
  lowestCash: number;
  lowestCashDate: string;
  firstShortfallDate: string | null;
  worstShortfall: number;
  minimumsOnly: { debtFreeDate: string | null; interestRemaining: number };
  interestSaved: number;
  monthsSaved: number | null;
}

export interface Projection {
  today: string;
  window: { from: string; to: string };
  horizonMonths: number;
  cashFloor: number;
  strategy: Strategy;
  assumption: string;
  summary: PlanSummary;
  banners: Banner[];
  days: ProjectedDay[];
  months: ProjectedMonth[];
  actions: PlanAction[];
  debts: ProjectedDebt[];
  debtSeries: DebtSeries;
  interestSeries: InterestSeries;
  reserveWindowDays: number;
  /** Days of action detail shown on the Plan page before the full-payoff popup. */
  nearTermDays: number;
}

export interface Plan {
  settings: PlanSettings;
  initialDeposit: CashEvent | null;
  debts: Debt[];
  events: CashEvent[];
  projection: Projection;
}

/** A field-level validation failure from the server. */
export interface FieldError {
  field: string;
  message: string;
}

export interface PlanEnvelope extends ApiEnvelope<Plan> {
  errors?: FieldError[];
}

/** Input shapes for writes. `promos` omitted on update leaves promos alone. */
export interface DebtInput {
  name: string;
  debtType: DebtType;
  balance: number | string;
  apr: number | string;
  dueDay: number | string;
  paymentKind: PaymentKind;
  fixedPayment?: number | string | null;
  overrideMin?: number | string | null;
  acceptsNewCharges: boolean;
  creditLimit?: number | string | null;
  annualFee?: number | string | null;
  annualFeeMonth?: number | string | null;
  carryingBalance: boolean;
  notes?: string | null;
  status?: ItemStatus;
  promos?: Array<{
    kind: PromoKind;
    apr: number | string;
    appliesToAmount?: number | string | null;
    endDate: string;
  }>;
}

export interface CashEventInput {
  name: string;
  amount: number | string;
  direction: Direction;
  startDate: string;
  cadence: Cadence;
  endDate?: string | null;
  canPutOnCard?: boolean;
  paymentMethod?: PaymentMethod;
  paymentDebtId?: number | null;
  locked?: boolean;
  status?: ItemStatus;
}

/** The window of daily detail the calendar currently needs. */
export interface PlanWindow {
  today: string;
  from: string;
  to: string;
}

const query = (planWindow: PlanWindow): string =>
  `?today=${planWindow.today}&from=${planWindow.from}&to=${planWindow.to}`;

export const fetchPlan = (planWindow: PlanWindow): Promise<PlanEnvelope> =>
  api<PlanEnvelope>(`/api/plan${query(planWindow)}`);

export const savePlanSettings = (
  patch: Partial<PlanSettings>,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> => put<PlanEnvelope>(`/api/plan/settings${query(planWindow)}`, patch);

export const saveStartingCash = (
  input: { amount: number | string; date: string; name?: string },
  planWindow: PlanWindow,
): Promise<PlanEnvelope> => put<PlanEnvelope>(`/api/plan/cash${query(planWindow)}`, input);

export const createDebt = (input: DebtInput, planWindow: PlanWindow): Promise<PlanEnvelope> =>
  post<PlanEnvelope>(`/api/debts${query(planWindow)}`, input);

export const updateDebt = (
  id: number,
  input: DebtInput,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> => put<PlanEnvelope>(`/api/debts/${id}${query(planWindow)}`, input);

export const deleteDebt = (id: number, planWindow: PlanWindow): Promise<PlanEnvelope> =>
  del<PlanEnvelope>(`/api/debts/${id}${query(planWindow)}`);

export const setDebtStatus = (
  id: number,
  status: ItemStatus,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> =>
  patch<PlanEnvelope>(`/api/debts/${id}/status${query(planWindow)}`, { status });

export const createCashEvent = (
  input: CashEventInput,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> => post<PlanEnvelope>(`/api/cash-events${query(planWindow)}`, input);

export const updateCashEvent = (
  id: number,
  input: CashEventInput,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> => put<PlanEnvelope>(`/api/cash-events/${id}${query(planWindow)}`, input);

export const deleteCashEvent = (id: number, planWindow: PlanWindow): Promise<PlanEnvelope> =>
  del<PlanEnvelope>(`/api/cash-events/${id}${query(planWindow)}`);

export const setCashEventStatus = (
  id: number,
  status: ItemStatus,
  planWindow: PlanWindow,
): Promise<PlanEnvelope> =>
  patch<PlanEnvelope>(`/api/cash-events/${id}/status${query(planWindow)}`, { status });

export const loadDemoPlan = (planWindow: PlanWindow): Promise<PlanEnvelope> =>
  post<PlanEnvelope>(`/api/plan/demo${query(planWindow)}`, { today: planWindow.today });

export const clearPlan = (planWindow: PlanWindow): Promise<PlanEnvelope> =>
  del<PlanEnvelope>(`/api/plan${query(planWindow)}`);
