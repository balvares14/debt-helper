/**
 * Request validation for debts and cash events.
 *
 * The database has CHECK constraints for all of this, but a constraint
 * violation surfaces as an opaque 500. Validating here means the user gets
 * told which field is wrong and why.
 */

const { isValidISODate } = require('./dates');

const DEBT_TYPES = ['credit_card', 'loan'];
const PAYMENT_KINDS = ['fixed', 'estimated_min', 'override_min'];
const PROMO_KINDS = ['purchase', 'existing_balance', 'deferred_interest'];
const DIRECTIONS = ['gain', 'charge'];
const CADENCES = ['one_time', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'yearly'];
const PAYMENT_METHODS = ['cash', 'card', 'optimizer'];
const STRATEGIES = ['optimized', 'snowball'];
const STATUSES = ['active', 'draft'];
const ACTUAL_STATUSES = ['confirmed', 'skipped', 'modified'];

const MAX_PROMOS_PER_DEBT = 2;

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function asText(value, maxLength = 120) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text.slice(0, maxLength);
}

/** Rounds money to cents so NUMERIC(14,2) never has to reject the insert. */
function asMoney(value) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed * 100) / 100;
}

function asRate(value) {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed * 1000) / 1000;
}

/** `null` when the value is present but not a legal status. */
function asStatus(value, fallback = 'active') {
  if (value === null || value === undefined || value === '') return fallback;
  return STATUSES.includes(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

function readSchedule(body, add, { defaultCadence }) {
  const startDate = isValidISODate(body.startDate) ? body.startDate : null;
  if (!startDate) add('startDate', 'Needs a valid start date (when this becomes active).');

  const cadence = CADENCES.includes(body.cadence) ? body.cadence : defaultCadence;

  let dueDate = isValidISODate(body.dueDate) ? body.dueDate : null;
  if (!dueDate && startDate) dueDate = startDate;
  if (!dueDate) add('dueDate', 'Needs a valid due date (when this hits).');

  let endDate = body.endDate ? (isValidISODate(body.endDate) ? body.endDate : null) : null;
  if (body.endDate && !endDate) {
    add('endDate', 'End date must be a valid date (YYYY-MM-DD).');
  } else if (endDate && startDate && endDate < startDate) {
    add('endDate', 'End date cannot be before the start date.');
  }
  if (cadence === 'one_time') endDate = null;

  return { startDate, cadence, dueDate, endDate };
}

function validateDebt(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  const name = asText(body.name);
  if (!name) add('name', 'Give this debt a name.');

  const debtType = DEBT_TYPES.includes(body.debtType) ? body.debtType : null;
  if (!debtType) add('debtType', `Type must be one of: ${DEBT_TYPES.join(', ')}.`);

  const balance = asMoney(body.balance);
  if (balance === null || balance < 0) add('balance', 'Balance must be $0 or more.');

  const apr = asRate(body.apr);
  if (apr === null || apr < 0 || apr > 100) add('apr', 'APR must be between 0 and 100.');

  const schedule = readSchedule(body, add, { defaultCadence: 'monthly' });

  // Installment loans keep a contract payment; revolving lines get an estimate
  // recomputed each cycle, so the user is not retyping the issuer minimum.
  const defaultKind = debtType === 'loan' ? 'fixed' : 'estimated_min';
  const paymentKind = PAYMENT_KINDS.includes(body.paymentKind) ? body.paymentKind : defaultKind;

  const fixedPayment = asMoney(body.fixedPayment);
  if (paymentKind === 'fixed' && (fixedPayment === null || fixedPayment <= 0)) {
    add('fixedPayment', 'Enter the contract payment for this loan.');
  }

  const overrideMin = asMoney(body.overrideMin);
  if (paymentKind === 'override_min' && (overrideMin === null || overrideMin < 0)) {
    add('overrideMin', 'Enter the statement minimum you want to use for this cycle.');
  }

  const acceptsNewCharges = asBoolean(body.acceptsNewCharges, debtType === 'credit_card');
  const creditLimit = asMoney(body.creditLimit);

  if (acceptsNewCharges) {
    if (debtType === 'loan') {
      add('acceptsNewCharges', 'A loan cannot take new charges. Only revolving lines can.');
    }
    if (creditLimit === null || creditLimit < 0) {
      add('creditLimit', 'A card that takes new charges needs a credit limit.');
    }
  }

  // Checked whenever a limit is given, not just on cards taking charges — the
  // table constraint applies either way, and a violation there would reach the
  // user as an unexplained 500.
  if (creditLimit !== null && balance !== null && balance > creditLimit) {
    add('creditLimit', 'Credit limit cannot be lower than the current balance.');
  }

  const annualFee = asMoney(body.annualFee) ?? 0;
  if (annualFee < 0) add('annualFee', 'Annual fee cannot be negative.');

  let annualFeeMonth = asNumber(body.annualFeeMonth);
  if (annualFee > 0) {
    if (annualFeeMonth === null) {
      annualFeeMonth = 1; // a fee with no month would silently never be charged
    } else if (!Number.isInteger(annualFeeMonth) || annualFeeMonth < 1 || annualFeeMonth > 12) {
      add('annualFeeMonth', 'Annual fee month must be 1-12.');
    }
  } else {
    annualFeeMonth = null;
  }

  const promos = validatePromos(body.promos, { balance, errors });

  const status = asStatus(body.status);
  if (!status) add('status', 'Status must be active or draft.');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      debtType,
      balance,
      apr,
      startDate: schedule.startDate,
      cadence: schedule.cadence,
      dueDate: schedule.dueDate,
      endDate: schedule.endDate,
      paymentKind,
      fixedPayment: paymentKind === 'fixed' ? fixedPayment : null,
      overrideMin: paymentKind === 'override_min' ? overrideMin : null,
      acceptsNewCharges,
      creditLimit,
      annualFee,
      annualFeeMonth,
      // Cards default to carrying a balance; a loan always does.
      carryingBalance: debtType === 'loan' ? true : asBoolean(body.carryingBalance, true),
      notes: asText(body.notes, 1000),
      status
    },
    promos
  };
}

function validatePromos(input, { balance, errors }) {
  if (!Array.isArray(input) || input.length === 0) return [];

  const add = (field, message) => errors.push({ field, message });

  if (input.length > MAX_PROMOS_PER_DEBT) {
    add('promos', `A debt can have at most ${MAX_PROMOS_PER_DEBT} promos.`);
    return [];
  }

  const seen = new Set();
  const promos = [];

  input.forEach((raw, index) => {
    const label = `promos[${index}]`;

    if (!PROMO_KINDS.includes(raw.kind)) {
      add(`${label}.kind`, `Promo kind must be one of: ${PROMO_KINDS.join(', ')}.`);
      return;
    }
    if (seen.has(raw.kind)) {
      add(`${label}.kind`, `Only one ${raw.kind} promo per debt.`);
      return;
    }
    seen.add(raw.kind);

    const apr = asRate(raw.apr) ?? 0;
    if (apr < 0 || apr > 100) add(`${label}.apr`, 'Promo APR must be between 0 and 100.');

    if (!isValidISODate(raw.endDate)) {
      add(`${label}.endDate`, 'Promo needs a valid end date (YYYY-MM-DD).');
      return;
    }

    // A purchase promo is a window for future spend, not a slice of the
    // current balance, so an amount on it would mean nothing.
    let appliesToAmount = null;
    if (raw.kind !== 'purchase') {
      appliesToAmount = asMoney(raw.appliesToAmount);
      if (appliesToAmount !== null) {
        if (appliesToAmount <= 0) {
          add(`${label}.appliesToAmount`, 'Promo amount must be more than $0.');
        } else if (balance !== null && appliesToAmount > balance) {
          add(`${label}.appliesToAmount`, 'Promo amount cannot exceed the balance.');
        }
      }
    }

    promos.push({ kind: raw.kind, apr, appliesToAmount, endDate: raw.endDate });
  });

  return promos;
}

// ---------------------------------------------------------------------------
// Cash events
// ---------------------------------------------------------------------------

/**
 * @param {object} body
 * @param {Array}  debts  the user's debts, for checking a pinned card is real
 */
function validateEvent(body, debts) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  const name = asText(body.name);
  if (!name) add('name', 'Give this gain or charge a name.');

  const amount = asMoney(body.amount);
  if (amount === null || amount <= 0) {
    add('amount', 'Amount must be more than $0. Use direction to say whether it is in or out.');
  }

  const direction = DIRECTIONS.includes(body.direction) ? body.direction : null;
  if (!direction) add('direction', 'Direction must be gain or charge.');

  const schedule = readSchedule(body, add, { defaultCadence: 'one_time' });

  let canPutOnCard = asBoolean(body.canPutOnCard, false);
  let paymentMethod = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : 'cash';
  let paymentDebtId = asNumber(body.paymentDebtId);
  let locked = asBoolean(body.locked, false);
  const status = asStatus(body.status);
  if (!status) add('status', 'Status must be active or draft.');

  // Money coming in always lands in cash. Routing only makes sense for spend.
  if (direction === 'gain') {
    canPutOnCard = false;
    paymentMethod = 'cash';
    paymentDebtId = null;
    locked = false;
  }

  if (paymentMethod === 'card') {
    const target = debts.find((debt) => Number(debt.id) === paymentDebtId);
    if (!target) {
      add('paymentDebtId', 'Pick a card to pin this charge to.');
    } else if (!target.acceptsNewCharges) {
      add('paymentDebtId', `${target.name} cannot take new charges, so it cannot pay for this.`);
    } else {
      canPutOnCard = true; // pinning to a card is itself proof it can go on one
    }
  } else {
    paymentDebtId = null;
  }

  // Asking the optimizer to route something that cannot go on a card leaves it
  // with one option, so say so plainly instead of pretending to optimize.
  if (paymentMethod === 'optimizer' && !canPutOnCard) {
    paymentMethod = 'cash';
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      amount,
      direction,
      startDate: schedule.startDate,
      cadence: schedule.cadence,
      dueDate: schedule.dueDate,
      endDate: schedule.endDate,
      canPutOnCard,
      paymentMethod,
      paymentDebtId,
      locked,
      isInitialDeposit: false,
      status
    }
  };
}

function validateSettings(body) {
  const errors = [];
  const patch = {};

  if (body.cashFloor !== undefined) {
    const cashFloor = asMoney(body.cashFloor);
    if (cashFloor === null || cashFloor < 0) {
      errors.push({ field: 'cashFloor', message: 'Cash floor must be $0 or more.' });
    } else {
      patch.cashFloor = cashFloor;
    }
  }

  if (body.strategy !== undefined) {
    if (!STRATEGIES.includes(body.strategy)) {
      errors.push({ field: 'strategy', message: `Strategy must be one of: ${STRATEGIES.join(', ')}.` });
    } else {
      patch.strategy = body.strategy;
    }
  }

  if (body.horizonMonths !== undefined) {
    const months = asNumber(body.horizonMonths);
    if (months === null || !Number.isInteger(months) || months < 1 || months > 60) {
      errors.push({ field: 'horizonMonths', message: 'Horizon must be a whole number of months from 1 to 60.' });
    } else {
      patch.horizonMonths = months;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: patch };
}

function validateActual(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  const date = isValidISODate(body.date) ? body.date : null;
  if (!date) add('date', 'Needs the date this happened on.');

  const itemKey = asText(body.itemKey, 80);
  if (!itemKey) add('itemKey', 'Needs which item this review is for.');

  const status = ACTUAL_STATUSES.includes(body.status) ? body.status : null;
  if (!status) add('status', 'Mark it as confirmed, skipped, or modified.');

  let amount = null;
  if (body.amount !== null && body.amount !== undefined && body.amount !== '') {
    amount = asMoney(body.amount);
    if (amount === null || amount < 0) add('amount', 'Amount has to be $0 or more.');
  }
  if (status === 'modified' && (amount === null || amount === undefined)) {
    add('amount', 'A changed amount needs the number you actually paid or received.');
  }

  const plannedAmount = body.plannedAmount === null || body.plannedAmount === undefined || body.plannedAmount === ''
    ? null
    : asMoney(body.plannedAmount);

  let debtId = body.debtId === null || body.debtId === undefined || body.debtId === ''
    ? null
    : Number(body.debtId);
  if (debtId !== null && (!Number.isInteger(debtId) || debtId <= 0)) {
    add('debtId', 'Debt id is not valid.');
    debtId = null;
  }

  const method = body.method === 'cash' || body.method === 'card' ? body.method : null;

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { date, itemKey, status, amount, plannedAmount, debtId, method }
  };
}

function validateInitialDeposit(body) {
  const errors = [];

  const amount = asMoney(body.amount);
  if (amount === null || amount < 0) {
    errors.push({ field: 'amount', message: 'Enter the cash you have on hand ($0 or more).' });
  }

  const date = body.date && isValidISODate(body.date) ? body.date : null;
  if (!date) {
    errors.push({ field: 'date', message: 'Needs the date this balance is accurate as of.' });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { amount, date, name: asText(body.name) || 'Starting cash' }
  };
}

module.exports = {
  DEBT_TYPES,
  PAYMENT_KINDS,
  PROMO_KINDS,
  DIRECTIONS,
  CADENCES,
  PAYMENT_METHODS,
  STRATEGIES,
  STATUSES,
  asStatus,
  validateDebt,
  validateEvent,
  validateSettings,
  validateInitialDeposit,
  validateActual
};
