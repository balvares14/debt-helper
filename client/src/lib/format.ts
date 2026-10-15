/**
 * Display helpers.
 *
 * Dates are handled as 'YYYY-MM-DD' strings and never turned into a Date for
 * formatting, because `new Date("2026-09-15")` parses as UTC midnight and
 * renders as the 14th anywhere west of Greenwich. Off-by-one days in a payment
 * calendar are not a cosmetic problem.
 */

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const WEEKDAY_INITIALS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today in the browser's own timezone. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function buildISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday, for laying out the calendar grid. */
export function weekdayOf(iso: string): number {
  const { year, month, day } = parseISO(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addMonthsISO(iso: string, count: number): string {
  const { year, month, day } = parseISO(iso);
  const total = year * 12 + (month - 1) + count;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return buildISO(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function addDaysISO(iso: string, count: number): string {
  const { year, month, day } = parseISO(iso);
  const shifted = new Date(Date.UTC(year, month - 1, day + count));
  return shifted.toISOString().slice(0, 10);
}

export function startOfMonthISO(iso: string): string {
  const { year, month } = parseISO(iso);
  return buildISO(year, month, 1);
}

export function endOfMonthISO(iso: string): string {
  const { year, month } = parseISO(iso);
  return buildISO(year, month, daysInMonth(year, month));
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** "September 2026" */
export function monthLabel(iso: string): string {
  const { year, month } = parseISO(iso);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Sep" from a day or a YYYY-MM key. */
export function shortMonth(isoOrKey: string): string {
  const key = isoOrKey.length >= 7 ? isoOrKey.slice(0, 7) : isoOrKey;
  const month = Number(key.slice(5, 7));
  return MONTH_NAMES[month - 1].slice(0, 3);
}

/** "Sep '26" — use on January or the first tick so the year is readable. */
export function shortMonthYear(isoOrKey: string): string {
  const key = isoOrKey.length >= 7 ? isoOrKey.slice(0, 7) : isoOrKey;
  const year = key.slice(2, 4);
  return `${shortMonth(key)} '${year}`;
}

/** "Sep 15" */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { month, day } = parseISO(iso);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}`;
}

/** "Sep 15, 2026" */
export function mediumDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { year, month, day } = parseISO(iso);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}, ${year}`;
}

/** "Tuesday, September 15, 2026" */
export function longDate(iso: string): string {
  const { year, month, day } = parseISO(iso);
  return `${WEEKDAY_NAMES[weekdayOf(iso)]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function money(value: number, options: { cents?: boolean } = {}): string {
  const showCents = options.cents ?? true;
  const sign = value < 0 ? "-" : "";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return `${sign}$${formatted}`;
}

/** Drops the cents when they are .00, for dense tables. */
export function moneyTrim(value: number): string {
  return money(value, { cents: Math.round(value * 100) % 100 !== 0 });
}

/** Short enough for a calendar cell: $1,240 -> $1.2k */
export function moneyCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);

  if (magnitude >= 10000) return `${sign}$${Math.round(magnitude / 1000)}k`;
  if (magnitude >= 1000) return `${sign}$${(magnitude / 1000).toFixed(1)}k`;
  return `${sign}$${Math.round(magnitude)}`;
}

export function percent(value: number): string {
  return `${Number(value).toFixed(2).replace(/\.00$/, "")}%`;
}

/** "11 months" / "1 year 3 months" */
export function monthsLabel(months: number | null): string {
  if (months === null || months === undefined) return "—";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = `${years} year${years === 1 ? "" : "s"}`;
  return rest === 0 ? yearPart : `${yearPart} ${rest} month${rest === 1 ? "" : "s"}`;
}

export const CADENCE_LABELS: Record<string, string> = {
  one_time: "One time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** "Monthly on day 1, from Oct 14, 2026" */
export function cadenceDetail(item: {
  cadence: string;
  startDate: string;
  dueDate?: string | null;
  endDate?: string | null;
}): string {
  const due = item.dueDate || item.startDate;
  const from = mediumDate(item.startDate);
  const until = item.endDate ? ` until ${mediumDate(item.endDate)}` : "";

  if (item.cadence === "one_time") return `On ${mediumDate(due)}`;

  if (item.cadence === "weekly" || item.cadence === "biweekly") {
    return `${CADENCE_LABELS[item.cadence]} on ${WEEKDAY_NAMES[weekdayOf(due)]}, from ${from}${until}`;
  }

  if (item.cadence === "yearly") {
    const { month, day } = parseISO(due);
    return `Yearly on ${MONTH_NAMES[month - 1]} ${day}, from ${from}${until}`;
  }

  if (item.cadence === "monthly" || item.cadence === "semimonthly") {
    const day = parseISO(due).day;
    const hit =
      item.cadence === "semimonthly" ? `days ${day} and ${Math.min(day + 15, 28)}` : `day ${day}`;
    return `${CADENCE_LABELS[item.cadence]} on ${hit}, from ${from}${until}`;
  }

  return `${CADENCE_LABELS[item.cadence] ?? item.cadence} from ${from}${until}`;
}

export const PROMO_LABELS: Record<string, string> = {
  purchase: "New purchases",
  existing_balance: "Existing balance",
  deferred_interest: "Deferred interest",
};

export const PAYMENT_KIND_LABELS: Record<string, string> = {
  fixed: "Fixed payment",
  estimated_min: "Estimated minimum",
  override_min: "Minimum you set",
};
