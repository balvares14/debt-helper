/**
 * A debt's live state during a projection.
 *
 * A balance is not one number at one rate. A card can hold a transferred
 * balance at 0% until March, new purchases at 0% until June, and everything
 * else at 29.99%. So a debt owns a list of *buckets*, each with its own APR
 * and its own expiry, and a payment has to be split across them the way an
 * issuer would split it.
 */

const { toCents, monthlyInterest } = require('./money');
const { toDayIndex, partsOf, monthKey } = require('./dates');

const MIN_PAYMENT_FLOOR_CENTS = 2500; // the usual "$25 or 1%, whichever is greater"
const MIN_PAYMENT_BALANCE_RATE = 0.01;

const BUCKET_STANDARD = 'standard';
const BUCKET_PURCHASE = 'purchase';

/** Builds the starting state for one debt row (with its promos attached). */
function createDebtState(debt) {
  const balanceCents = toCents(debt.balance);
  const standardApr = Number(debt.apr) || 0;
  const promos = debt.promos || [];

  const buckets = [];
  let unallocated = balanceCents;

  // Existing-balance promos carve a slice out of what is already owed.
  for (const promo of promos) {
    if (promo.kind !== 'existing_balance' && promo.kind !== 'deferred_interest') continue;
    if (unallocated <= 0) break;

    const requested = promo.appliesToAmount === null || promo.appliesToAmount === undefined
      ? unallocated
      : toCents(promo.appliesToAmount);
    const amount = Math.min(requested, unallocated);
    if (amount <= 0) continue;

    buckets.push({
      key: promo.kind,
      promoId: promo.id,
      apr: Number(promo.apr) || 0,
      endDate: promo.endDate,
      balanceCents: amount,
      isDeferred: promo.kind === 'deferred_interest',
      // Interest a deferred-interest promo is quietly racking up in the
      // background, charged in full if the balance is not cleared in time.
      deferredAccruedCents: 0
    });

    unallocated -= amount;
  }

  // Whatever is left sits at the standard rate, and it is where expired
  // promo balances land.
  buckets.push({
    key: BUCKET_STANDARD,
    promoId: null,
    apr: standardApr,
    endDate: null,
    balanceCents: unallocated,
    isDeferred: false,
    deferredAccruedCents: 0
  });

  const purchasePromo = promos.find((promo) => promo.kind === 'purchase') || null;

  return {
    id: debt.id,
    name: debt.name,
    type: debt.debtType,
    standardApr,
    startDate: debt.startDate || null,
    balanceAsOf: debt.balanceAsOf || null,
    cadence: debt.cadence || 'monthly',
    dueDate: debt.dueDate || null,
    endDate: debt.endDate || null,
    dueDay: debt.dueDay,
    paymentKind: debt.paymentKind,
    fixedPaymentCents: toCents(debt.fixedPayment),
    overrideMinCents: toCents(debt.overrideMin),
    // An override is this cycle's statement minimum, so it is used once and
    // then we fall back to the estimate.
    overrideUsed: false,
    acceptsNewCharges: !!debt.acceptsNewCharges,
    creditLimitCents: debt.creditLimit === null || debt.creditLimit === undefined
      ? null
      : toCents(debt.creditLimit),
    annualFeeCents: toCents(debt.annualFee),
    annualFeeMonth: debt.annualFeeMonth || null,
    carryingBalance: !!debt.carryingBalance,
    noExtraPayoff: !!debt.noExtraPayoff,
    purchasePromo: purchasePromo
      ? { apr: Number(purchasePromo.apr) || 0, endDate: purchasePromo.endDate }
      : null,
    buckets,
    startingBalanceCents: balanceCents,
    interestChargedCents: 0,
    paidCents: 0,
    newSpendCents: 0,
    lastAccrualMonth: null,
    lastAnnualFeeYear: null,
    paidOffDate: null
  };
}

function totalBalanceCents(state) {
  return state.buckets.reduce((sum, bucket) => sum + bucket.balanceCents, 0);
}

function availableCreditCents(state) {
  if (state.creditLimitCents === null) return 0;
  return Math.max(0, state.creditLimitCents - totalBalanceCents(state));
}

function findStandardBucket(state) {
  return state.buckets.find((bucket) => bucket.key === BUCKET_STANDARD);
}

/** True when this card's purchase promo still covers spend made on `date`. */
function purchasePromoActive(state, date) {
  if (!state.purchasePromo) return false;
  return toDayIndex(date) <= toDayIndex(state.purchasePromo.endDate);
}

/** The rate new spend on this card would start accruing at on `date`. */
function purchaseApr(state, date) {
  if (!state.carryingBalance) return 0; // paid in full monthly, so no interest
  if (purchasePromoActive(state, date)) return state.purchasePromo.apr;
  return state.standardApr;
}

/**
 * Retires promo buckets whose end date has passed.
 *
 * A deferred-interest promo that still has a balance on its drop-dead date
 * charges every cent of interest it had been holding back.
 */
function expirePromos(state, date, onBackInterest) {
  const today = toDayIndex(date);
  const standard = findStandardBucket(state);

  for (let index = state.buckets.length - 1; index >= 0; index -= 1) {
    const bucket = state.buckets[index];
    if (!bucket.endDate || bucket.key === BUCKET_STANDARD) continue;
    if (today <= toDayIndex(bucket.endDate)) continue;

    if (bucket.isDeferred && bucket.balanceCents > 0 && bucket.deferredAccruedCents > 0) {
      standard.balanceCents += bucket.deferredAccruedCents;
      state.interestChargedCents += bucket.deferredAccruedCents;
      if (onBackInterest) {
        onBackInterest({
          debtId: state.id,
          debtName: state.name,
          amountCents: bucket.deferredAccruedCents,
          date
        });
      }
    }

    // Leftover promo balance reverts to the standard rate.
    standard.balanceCents += bucket.balanceCents;
    state.buckets.splice(index, 1);
  }
}

/**
 * Charges one month of interest, once per calendar month, on the due day.
 * Returns the interest added, which feeds the minimum-payment estimate.
 */
function accrueMonthlyInterest(state, date) {
  const month = monthKey(date);
  if (state.lastAccrualMonth === month) return 0;
  state.lastAccrualMonth = month;

  // A card paid in full every month never gets charged interest; that is what
  // "not carrying a balance" means.
  if (!state.carryingBalance) return 0;

  let charged = 0;
  for (const bucket of state.buckets) {
    if (bucket.balanceCents <= 0) continue;

    const interest = monthlyInterest(bucket.balanceCents, bucket.apr);
    if (interest > 0) {
      bucket.balanceCents += interest;
      charged += interest;
    }

    // A 0% deferred promo charges nothing now but remembers what it would
    // have charged at the standard rate.
    if (bucket.isDeferred) {
      bucket.deferredAccruedCents += monthlyInterest(bucket.balanceCents, state.standardApr);
    }
  }

  state.interestChargedCents += charged;
  return charged;
}

/** The annual fee, if it lands in this month, added to the standard bucket. */
function applyAnnualFee(state, date) {
  if (state.annualFeeCents <= 0 || !state.annualFeeMonth) return 0;

  const { year, month } = partsOf(date);
  if (month !== state.annualFeeMonth || state.lastAnnualFeeYear === year) return 0;

  state.lastAnnualFeeYear = year;
  findStandardBucket(state).balanceCents += state.annualFeeCents;
  return state.annualFeeCents;
}

/**
 * What the user must pay this cycle to stay current. Never more than is owed,
 * and never something the user has to keep re-typing as the balance moves.
 */
function requiredPaymentCents(state, interestThisCycleCents) {
  const owed = totalBalanceCents(state);
  if (owed <= 0) return 0;

  // Paying the statement in full is the whole point of a non-carrying card.
  if (!state.carryingBalance) return owed;

  if (state.paymentKind === 'fixed') {
    // Installment loans keep the contract payment until the final short one.
    return Math.min(state.fixedPaymentCents, owed);
  }

  if (state.paymentKind === 'override_min' && !state.overrideUsed) {
    state.overrideUsed = true;
    return Math.min(state.overrideMinCents, owed);
  }

  const estimated = Math.round(owed * MIN_PAYMENT_BALANCE_RATE) + interestThisCycleCents;
  return Math.min(owed, Math.max(MIN_PAYMENT_FLOOR_CENTS, estimated));
}

/** Estimated minimum for display, without mutating override state. */
function estimatedMinimumCents(state) {
  const owed = totalBalanceCents(state);
  if (owed <= 0) return 0;
  if (!state.carryingBalance) return owed;
  if (state.paymentKind === 'fixed') return Math.min(state.fixedPaymentCents, owed);

  const interest = state.buckets.reduce(
    (sum, bucket) => sum + monthlyInterest(bucket.balanceCents, bucket.apr),
    0
  );
  const estimated = Math.round(owed * MIN_PAYMENT_BALANCE_RATE) + interest;
  return Math.min(owed, Math.max(MIN_PAYMENT_FLOOR_CENTS, estimated));
}

/**
 * Bucket order for a required payment: cheapest rate first.
 *
 * This mirrors the CARD Act — the issuer applies your minimum to the
 * lowest-rate balance and only amounts *above* the minimum to the highest.
 * Modelling it the other way round would invent savings that do not exist.
 */
function requiredAllocationOrder(state) {
  return [...state.buckets].sort((a, b) => a.apr - b.apr);
}

/**
 * Bucket order for extra payments: the expensive and the time-critical first.
 *
 * A deferred-interest bucket goes to the front even at 0%, because missing its
 * deadline retroactively charges every month of interest it skipped.
 */
function extraAllocationOrder(state) {
  return [...state.buckets].sort((a, b) => {
    if (a.isDeferred !== b.isDeferred) return a.isDeferred ? -1 : 1;
    if (b.apr !== a.apr) return b.apr - a.apr;
    return b.balanceCents - a.balanceCents;
  });
}

/** Pays `amountCents` across buckets in `order`. Returns what was actually
 *  applied, which is less than requested once the debt is clear. */
function applyPaymentCents(state, amountCents, order) {
  let remaining = Math.min(amountCents, totalBalanceCents(state));
  if (remaining <= 0) return 0;

  const applied = remaining;
  for (const bucket of order) {
    if (remaining <= 0) break;
    const take = Math.min(bucket.balanceCents, remaining);
    bucket.balanceCents -= take;
    remaining -= take;
  }

  state.paidCents += applied;
  return applied;
}

function payRequired(state, amountCents) {
  return applyPaymentCents(state, amountCents, requiredAllocationOrder(state));
}

function payExtra(state, amountCents) {
  return applyPaymentCents(state, amountCents, extraAllocationOrder(state));
}

/** Adds new spend to the right bucket for the date it happened. */
function addCharge(state, amountCents, date) {
  if (amountCents <= 0) return;

  if (state.carryingBalance && purchasePromoActive(state, date)) {
    const { apr, endDate } = state.purchasePromo;
    let bucket = state.buckets.find(
      (candidate) => candidate.key === BUCKET_PURCHASE && candidate.endDate === endDate
    );
    if (!bucket) {
      bucket = {
        key: BUCKET_PURCHASE,
        promoId: null,
        apr,
        endDate,
        balanceCents: 0,
        isDeferred: false,
        deferredAccruedCents: 0
      };
      state.buckets.push(bucket);
    }
    bucket.balanceCents += amountCents;
  } else {
    findStandardBucket(state).balanceCents += amountCents;
  }

  state.newSpendCents += amountCents;
}

/** The rate an extra dollar sent to this debt would actually retire. */
function effectiveAprPercent(state) {
  const target = extraAllocationOrder(state).find((bucket) => bucket.balanceCents > 0);
  return target ? target.apr : 0;
}

/** Soonest promo expiry with a balance behind it, for tie-breaking. */
function soonestPromoEnd(state) {
  const ends = state.buckets
    .filter((bucket) => bucket.endDate && bucket.balanceCents > 0)
    .map((bucket) => toDayIndex(bucket.endDate));
  return ends.length > 0 ? Math.min(...ends) : Infinity;
}

/** A deferred-interest bucket that is not on track to be clear in time. */
function deferredRisk(state, date) {
  const today = toDayIndex(date);
  const at = state.buckets.find(
    (bucket) => bucket.isDeferred && bucket.balanceCents > 0 && toDayIndex(bucket.endDate) >= today
  );
  if (!at) return null;

  const daysLeft = toDayIndex(at.endDate) - today;
  return {
    bucket: at,
    daysLeft,
    balanceCents: at.balanceCents,
    backInterestCents: at.deferredAccruedCents,
    endDate: at.endDate
  };
}

/** True once the calendar day has reached this debt's start date. */
function isActiveOn(state, date) {
  if (state.startDate && date < state.startDate) return false;
  if (state.endDate && date > state.endDate) return false;
  return true;
}

module.exports = {
  MIN_PAYMENT_FLOOR_CENTS,
  BUCKET_STANDARD,
  BUCKET_PURCHASE,
  createDebtState,
  totalBalanceCents,
  availableCreditCents,
  findStandardBucket,
  purchasePromoActive,
  purchaseApr,
  expirePromos,
  accrueMonthlyInterest,
  applyAnnualFee,
  requiredPaymentCents,
  estimatedMinimumCents,
  payRequired,
  payExtra,
  addCharge,
  effectiveAprPercent,
  soonestPromoEnd,
  deferredRisk,
  isActiveOn
};
