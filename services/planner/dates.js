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

/** 0 = Sunday, matching Date#getUTCDay. */
function weekdayOf(iso) {
  return new Date(toDayIndex(iso) * MS_PER_DAY).getUTCDay();
}

/** First day-of-month `occurDay` on or after `iso`. */
function firstOccurDayOnOrAfter(iso, occurDay) {
  const dueThisMonth = dueDateInMonth(iso, occurDay);
  if (dueThisMonth >= iso) return dueThisMonth;
  return dueDateInMonth(addMonths(iso, 1), occurDay);
}

/**
 * Shared schedule for debts and cash events:
 *   startDate — when the item becomes active
 *   dueDate   — the first day it is charged or gained
 *   cadence   — how later copies are counted from that due date
 *   endDate   — optional last day it can land
 *
 * Recurrences only go forward from dueDate, and never before startDate.
 */
function scheduleOf(item, fallbackDate) {
  const startDate = item.startDate || fallbackDate;
  const cadence = item.cadence || (item.dueDay ? 'monthly' : 'one_time');
  let dueDate = item.dueDate;
  if (!dueDate && item.dueDay && startDate) {
    dueDate = firstOccurDayOnOrAfter(startDate, item.dueDay);
  }
  if (!dueDate) dueDate = startDate;
  return { startDate, dueDate, cadence, endDate: item.endDate || null };
}

/**
 * Every date this item lands on within [fromISO, toISO], inclusive.
 */
function occurrencesBetween(item, fromISO, toISODate) {
  const { startDate, dueDate, cadence, endDate } = scheduleOf(item, fromISO);
  const windowStart = toDayIndex(fromISO);
  const windowEnd = toDayIndex(toISODate);
  const activeFrom = toDayIndex(startDate);
  const stop = endDate ? Math.min(windowEnd, toDayIndex(endDate)) : windowEnd;
  const floor = Math.max(windowStart, activeFrom);

  if (stop < windowStart || stop < activeFrom) return [];

  if (cadence === 'one_time') {
    const hit = toDayIndex(dueDate);
    return hit >= floor && hit <= stop ? [dueDate] : [];
  }

  const stepDays = CADENCE_STEP_DAYS[cadence];
  if (stepDays) {
    const anchor = toDayIndex(dueDate);
    let day = anchor;
    if (day < floor) {
      day = anchor + Math.ceil((floor - anchor) / stepDays) * stepDays;
    }
    const dates = [];
    for (; day <= stop; day += stepDays) {
      dates.push(toISO(day));
    }
    return dates;
  }

  if (cadence === 'monthly' || cadence === 'semimonthly' || cadence === 'yearly') {
    return monthlyFamilyOccurrences({ dueDate, cadence }, floor, stop);
  }

  return [];
}

function monthlyFamilyOccurrences(schedule, floor, stop) {
  const { dueDate, cadence } = schedule;
  const { day: dueDay } = partsOf(dueDate);
  const first = Math.max(floor, toDayIndex(dueDate));
  const dates = [];

  if (cadence === 'yearly') {
    let cursor = dueDate;
    while (toDayIndex(cursor) < first) cursor = addMonths(cursor, 12);
    while (toDayIndex(cursor) <= stop) {
      dates.push(cursor);
      cursor = addMonths(cursor, 12);
    }
    return dates;
  }

  let monthCursor = startOfMonth(dueDate);
  while (toDayIndex(monthCursor) <= stop) {
    const { year, month } = partsOf(monthCursor);
    const hits = [dueDateInMonth(monthCursor, dueDay)];
    if (cadence === 'semimonthly') {
      hits.push(buildISO(year, month, Math.min(dueDay + 15, daysInMonth(year, month))));
    }
    for (const hit of hits) {
      const index = toDayIndex(hit);
      if (index >= first && index <= stop) dates.push(hit);
    }
    monthCursor = addMonths(monthCursor, 1);
  }

  return [...new Set(dates)].sort();
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
  weekdayOf,
  firstOccurDayOnOrAfter,
  scheduleOf,
  occurrencesBetween,
  dueDateInMonth
};
