/**
 * Calendar-day math on 'YYYY-MM-DD' strings.
 *
 * The planner never deals in instants, only in days, so everything here works
 * on a UTC day index. That keeps a projection identical whether it runs on a
 * laptop in Los Angeles or a server in UTC.
 */

const MS_PER_DAY = 86400000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  return toISO(toDayIndex(value)) === value; // rejects 2026-02-30
}

/** 'YYYY-MM-DD' -> integer day index (days since the epoch, UTC). */
function toDayIndex(iso) {
  const match = ISO_DATE.exec(String(iso));
  if (!match) throw new Error(`Invalid date: ${iso}`);
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / MS_PER_DAY;
}

/** Day index -> 'YYYY-MM-DD'. */
function toISO(dayIndex) {
  return new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  return toISO(toDayIndex(iso) + days);
}

function daysBetween(fromISO, toISODate) {
  return toDayIndex(toISODate) - toDayIndex(fromISO);
}

function partsOf(iso) {
  const match = ISO_DATE.exec(String(iso));
  if (!match) throw new Error(`Invalid date: ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Same day-of-month `count` months later, clamped to the month's length so
 *  the 31st becomes the 28th/30th instead of spilling into the next month. */
function addMonths(iso, count) {
  const { year, month, day } = partsOf(iso);
  const totalMonths = year * 12 + (month - 1) + count;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return buildISO(targetYear, targetMonth, clampedDay);
}

function buildISO(year, month, day) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** 'YYYY-MM' for grouping days into calendar months. */
function monthKey(iso) {
  return String(iso).slice(0, 7);
}

function startOfMonth(iso) {
  const { year, month } = partsOf(iso);
  return buildISO(year, month, 1);
}

function endOfMonth(iso) {
  const { year, month } = partsOf(iso);
  return buildISO(year, month, daysInMonth(year, month));
}

/** Today in the given IANA zone, so "today" matches the user's calendar
 *  rather than the server's. Falls back to UTC for an unknown zone. */
function todayISO(timeZone) {
  const now = new Date();
  if (!timeZone) return now.toISOString().slice(0, 10);

  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const CADENCE_STEP_DAYS = { weekly: 7, biweekly: 14 };

/**
 * Every date this event lands on within [fromISO, toISO], inclusive.
 *
 * Occurrences are anchored to `startDate` and never generated before it, so
 * moving the window does not shift the pattern.
 */
function occurrencesBetween(event, fromISO, toISODate) {
  const { startDate, cadence, endDate } = event;
  const windowStart = toDayIndex(fromISO);
  const windowEnd = toDayIndex(toISODate);
  const anchor = toDayIndex(startDate);
  const stop = endDate ? Math.min(windowEnd, toDayIndex(endDate)) : windowEnd;

  if (stop < windowStart || stop < anchor) return [];

  if (cadence === 'one_time') {
    return anchor >= windowStart && anchor <= stop ? [toISO(anchor)] : [];
  }

  const stepDays = CADENCE_STEP_DAYS[cadence];
  if (stepDays) {
    // Jump straight to the first occurrence inside the window.
    const skipped = Math.max(0, Math.ceil((windowStart - anchor) / stepDays));
    const dates = [];
    for (let day = anchor + skipped * stepDays; day <= stop; day += stepDays) {
      dates.push(toISO(day));
    }
    return dates;
  }

  if (cadence === 'monthly' || cadence === 'semimonthly' || cadence === 'yearly') {
    return monthlyFamilyOccurrences(event, anchor, windowStart, stop);
  }

  return [];
}

/** monthly / semimonthly / yearly all walk month-by-month from the anchor. */
function monthlyFamilyOccurrences(event, anchor, windowStart, stop) {
  const { cadence, startDate } = event;
  const monthStep = cadence === 'yearly' ? 12 : 1;
  const { day: anchorDay } = partsOf(startDate);

  // Start a step early so a semimonthly second-half date near the window edge
  // is not missed, then filter.
  const anchorParts = partsOf(startDate);
  const windowStartParts = partsOf(toISO(windowStart));
  const monthsApart =
    (windowStartParts.year - anchorParts.year) * 12 + (windowStartParts.month - anchorParts.month);
  const startStep = Math.max(0, Math.floor(monthsApart / monthStep) - 1);

  const dates = [];
  for (let step = startStep; ; step += 1) {
    const base = addMonths(startDate, step * monthStep);
    const baseIndex = toDayIndex(base);

    const candidates = [baseIndex];
    if (cadence === 'semimonthly') {
      // Twice a month: the anchor day and ~15 days later, clamped.
      const { year, month } = partsOf(base);
      const secondDay = Math.min(anchorDay + 15, daysInMonth(year, month));
      candidates.push(toDayIndex(buildISO(year, month, secondDay)));
    }

    for (const candidate of candidates) {
      if (candidate >= Math.max(windowStart, anchor) && candidate <= stop) {
        dates.push(toISO(candidate));
      }
    }

    if (baseIndex > stop) break;
  }

  return dates.sort();
}

/** The debt's due date inside the month containing `iso`. */
function dueDateInMonth(iso, dueDay) {
  const { year, month } = partsOf(iso);
  return buildISO(year, month, Math.min(dueDay, daysInMonth(year, month)));
}

module.exports = {
  MS_PER_DAY,
  isValidISODate,
  toDayIndex,
  toISO,
  addDays,
  addMonths,
  daysBetween,
  partsOf,
  daysInMonth,
  buildISO,
  monthKey,
  startOfMonth,
  endOfMonth,
  todayISO,
  occurrencesBetween,
  dueDateInMonth
};
