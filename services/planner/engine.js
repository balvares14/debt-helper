/**
 * The projection engine.
 *
 * Walks the calendar one day at a time from today, applying gains, charges,
 * interest, required payments and extra payoff, and records what the balance
 * looks like on every one of those days.
 *
 * The rule that shapes the whole design: extra payoff may never create a
 * shortfall later. Deciding that from today's balance alone is not enough —
 * $2,000 in the bank on the 1st is not spare money when rent is due on the
 * 3rd. Before paying extra the engine replays the rest of the plan (same
 * horizon as debt-free) with extras off and takes the *lowest* cash it finds.
 * That low point, not today's balance, is what can safely be spent.
 */

const { toCents, toDollars, clampToZero } = require('./money');
const dates = require('./dates');
const debtState = require('./debtState');

/** How far ahead to reserve cash for known obligations: the same horizon the
 *  debt-free plan already walks. A fixed 45-day window missed the next copy
 *  of a monthly bill; the plan's own end date does not. */

/** Cap on the deferred-interest lookahead, which can reach further out. */
const DEFERRED_PROBE_MAX_DAYS = 550;

/** Days shown on the Plan page before the "…" that opens the full payoff list. */
const NEAR_TERM_DAYS = 45;

const DEFAULT_HORIZON_MONTHS = 60;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Indexes every gain and charge by the date it lands on, once, so a day step
 * is O(events that day) instead of O(all events). The probe replays the same
 * days thousands of times, which makes this the difference between instant
 * and sluggish.
 */
function buildOccurrenceMap(events, fromISO, toISO) {
  const map = new Map();

  for (const event of events) {
    for (const date of dates.occurrencesBetween(event, fromISO, toISO)) {
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(event);
    }
  }

  return map;
}

function cloneState(state) {
  return {
    cashCents: state.cashCents,
    debts: state.debts.map((debt) => ({
      ...debt,
      purchasePromo: debt.purchasePromo ? { ...debt.purchasePromo } : null,
      buckets: debt.buckets.map((bucket) => ({ ...bucket }))
    }))
  };
}

function totalOutstandingCents(state) {
  return state.debts.reduce((sum, debt) => sum + debtState.totalBalanceCents(debt), 0);
}

// ---------------------------------------------------------------------------
// Spend routing
// ---------------------------------------------------------------------------

/**
 * Decides whether a charge comes out of cash or goes on a card.
 *
 * Cards are only the better answer when the spend genuinely floats free — a
 * 0% purchase window, or a card paid in full every month. Putting groceries on
 * a card that is already carrying a balance at 25% starts costing interest the
 * day it posts, so cash wins whenever cash is actually available.
 */
function routeCharge(ctx, state, event, amountCents, date) {
  const pinnedDebt = event.paymentDebtId
    ? state.debts.find((debt) => String(debt.id) === String(event.paymentDebtId))
    : null;

  // A pinned card stays pinned, even when it no longer fits.
  if (event.paymentMethod === 'card' && pinnedDebt) {
    const room = debtState.availableCreditCents(pinnedDebt);
    return {
      method: 'card',
      debt: pinnedDebt,
      overLimit: room < amountCents,
      pinned: true,
      reason: `Pinned to ${pinnedDebt.name}.`
    };
  }

  const canOptimize = event.paymentMethod === 'optimizer' && event.canPutOnCard && !event.locked;
  if (!canOptimize) {
    return { method: 'cash', reason: 'Cash only.' };
  }

  const cards = state.debts
    .filter((debt) => debt.acceptsNewCharges)
    .map((debt) => ({
      debt,
      apr: debtState.purchaseApr(debt, date),
      promoEnd: debt.purchasePromo ? debt.purchasePromo.endDate : null,
      floats: !debt.carryingBalance || debtState.purchasePromoActive(debt, date),
      hasRoom: debtState.availableCreditCents(debt) >= amountCents
    }));

  const candidates = cards.filter((card) => card.hasRoom);

  // Interest-free room: take it, and prefer the longest runway.
  const free = candidates
    .filter((candidate) => candidate.apr === 0 && candidate.floats)
    .sort((a, b) => {
      const aEnd = a.promoEnd ? dates.toDayIndex(a.promoEnd) : Infinity;
      const bEnd = b.promoEnd ? dates.toDayIndex(b.promoEnd) : Infinity;
      return bEnd - aEnd;
    });

  if (free.length > 0) {
    const pick = free[0];
    return {
      method: 'card',
      debt: pick.debt,
      overLimit: false,
      pinned: false,
      reason: pick.promoEnd
        ? `${pick.debt.name} is 0% on purchases until ${pick.promoEnd}, so this costs nothing to carry.`
        : `${pick.debt.name} is paid in full each month, so this carries no interest.`
    };
  }

  // No free card. Cash is the right answer unless it would overdraw the account.
  if (state.cashCents - amountCents >= 0) {
    // Say which of the two reasons applies, because "your 0% card is full" and
    // "you have no 0% card" call for completely different fixes.
    const fullButFree = cards.filter((card) => card.apr === 0 && card.floats && !card.hasRoom);
    const reason = fullButFree.length > 0
      ? `${fullButFree[0].debt.name} is still 0% on purchases but has no room left, so this comes out of cash.`
      : 'No 0% purchase window open, and cash covers it without going negative.';

    return { method: 'cash', reason };
  }

  // Cash cannot cover it. Borrowing at the lowest rate available beats an overdraft.
  const cheapest = [...candidates].sort((a, b) => a.apr - b.apr)[0];
  if (cheapest) {
    return {
      method: 'card',
      debt: cheapest.debt,
      overLimit: false,
      pinned: false,
      reason: `Cash would go negative, so this goes on ${cheapest.debt.name} (${cheapest.apr.toFixed(2)}%).`
    };
  }

  return { method: 'cash', reason: 'No card has room, so this has to come out of cash.' };
}

// ---------------------------------------------------------------------------
// Extra payoff targeting
// ---------------------------------------------------------------------------

/**
 * Whether a deferred-interest balance clears on its own before the drop-dead
 * date. If it does not, it jumps the queue: missing that date charges back
 * every month of interest the promo had been holding off.
 */
function deferredNeedsSurplus(ctx, state, debtIndex, date) {
  const risk = debtState.deferredRisk(state.debts[debtIndex], date);
  if (!risk) return null;

  const days = Math.min(risk.daysLeft, DEFERRED_PROBE_MAX_DAYS);
  const probe = cloneState(state);

  for (let offset = 1; offset <= days; offset += 1) {
    stepDay(ctx, probe, dates.addDays(date, offset), { allowExtra: false });
  }

  const after = debtState.deferredRisk(probe.debts[debtIndex], dates.addDays(date, days));
  const stillOwed = after ? after.balanceCents : 0;

  return stillOwed > 0 ? { ...risk, shortfallCents: stillOwed } : null;
}

/** Picks the debt an extra dollar should go to today. */
function chooseExtraTarget(ctx, state, date) {
  const live = state.debts
    .map((debt, index) => ({ debt, index }))
    .filter(({ debt }) => debtState.totalBalanceCents(debt) > 0);

  if (live.length === 0) return null;

  // Deadlines before rates.
  const atRisk = live
    .map((entry) => ({ ...entry, risk: deferredNeedsSurplus(ctx, state, entry.index, date) }))
    .filter((entry) => entry.risk)
    .sort((a, b) => dates.toDayIndex(a.risk.endDate) - dates.toDayIndex(b.risk.endDate));

  if (atRisk.length > 0) {
    const pick = atRisk[0];
    return {
      debt: pick.debt,
      reason: `${pick.debt.name} has a deferred-interest deadline on ${pick.risk.endDate}. Clearing it first avoids ${formatDollars(pick.risk.backInterestCents)} of back-interest.`
    };
  }

  if (ctx.strategy === 'snowball') {
    const pick = [...live].sort(
      (a, b) => debtState.totalBalanceCents(a.debt) - debtState.totalBalanceCents(b.debt)
    )[0];
    return {
      debt: pick.debt,
      reason: `Smallest balance left, so it clears soonest (snowball).`
    };
  }

  const pick = [...live].sort((a, b) => {
    const aApr = debtState.effectiveAprPercent(a.debt);
    const bApr = debtState.effectiveAprPercent(b.debt);
    if (bApr !== aApr) return bApr - aApr;

    const aEnd = debtState.soonestPromoEnd(a.debt);
    const bEnd = debtState.soonestPromoEnd(b.debt);
    if (aEnd !== bEnd) return aEnd - bEnd;

    return debtState.totalBalanceCents(b.debt) - debtState.totalBalanceCents(a.debt);
  })[0];

  return {
    debt: pick.debt,
    reason: `Highest rate you are actually paying (${debtState.effectiveAprPercent(pick.debt).toFixed(2)}%), so every dollar here saves the most interest.`
  };
}

/**
 * Lowest cash from tomorrow through the plan horizon if no more extra is paid.
 *
 * Stops early once cash is already under the floor — extra will be zero.
 * Paying extra can change later routing, so surplusAboveFloorCents re-checks
 * after subtracting the candidate amount.
 */
function lowestCashThroughHorizon(ctx, state, date, floor) {
  const probe = cloneState(state);
  let lowest = probe.cashCents;
  const start = dates.toDayIndex(date) + 1;

  for (let dayIndex = start; dayIndex <= ctx.endDayIndex; dayIndex += 1) {
    stepDay(ctx, probe, dates.toISO(dayIndex), { allowExtra: false });
    if (probe.cashCents < lowest) {
      lowest = probe.cashCents;
      if (lowest < floor) return lowest;
    }
  }

  return lowest;
}

/**
 * Cash that can be sent at debt today without causing a later hole anywhere
 * in the plan — not just the next month.
 */
function surplusAboveFloorCents(ctx, state, date) {
  const floor = Math.max(ctx.cashFloorCents, 0);
  let extra = clampToZero(lowestCashThroughHorizon(ctx, state, date, floor) - floor);

  // One replay with the extra removed: if a later bill that floated on a card
  // now has to come out of cash, shrink until the hole is gone.
  for (let step = 0; step < 3 && extra > 0; step += 1) {
    const test = cloneState(state);
    test.cashCents -= extra;
    const low = lowestCashThroughHorizon(ctx, test, date, floor);
    if (low >= floor) return extra;
    extra = clampToZero(extra - (floor - low));
  }

  return extra;
}

// ---------------------------------------------------------------------------
// One day
// ---------------------------------------------------------------------------

/**
 * Advances `state` through a single calendar day.
 *
 * Both the real projection and the lookahead probes run through here, which is
 * what makes the probe trustworthy: it is the same code, just with `allowExtra`
 * off and nothing recorded.
 */
function stepDay(ctx, state, date, options) {
  const { allowExtra } = options;
  const record = options.record || null;

  if (record) record.startCashCents = state.cashCents;

  // 1. Retire promos that ended, charging deferred back-interest if it applies.
  for (const debt of state.debts) {
    debtState.expirePromos(debt, date, record ? (event) => record.backInterest.push(event) : null);
  }

  // 2. Money in before money out, so a same-day paycheck covers a same-day bill.
  for (const event of ctx.occurrences.get(date) || []) {
    if (event.direction !== 'gain') continue;
    const amountCents = toCents(event.amount);
    state.cashCents += amountCents;
    if (record) record.gains.push({ id: event.id, name: event.name, amountCents });
  }

  // 3. Charges, each either paid from cash or pushed onto a card.
  for (const event of ctx.occurrences.get(date) || []) {
    if (event.direction !== 'charge') continue;
    const amountCents = toCents(event.amount);
    const route = routeCharge(ctx, state, event, amountCents, date);

    if (route.method === 'card' && route.debt) {
      debtState.addCharge(route.debt, amountCents, date);
    } else {
      state.cashCents -= amountCents;
    }

    if (record) {
      record.charges.push({
        id: event.id,
        name: event.name,
        amountCents,
        method: route.method,
        debtId: route.debt ? route.debt.id : null,
        debtName: route.debt ? route.debt.name : null,
        pinned: !!route.pinned,
        overLimit: !!route.overLimit,
        optimized: event.paymentMethod === 'optimizer' && event.canPutOnCard && !event.locked,
        reason: route.reason
      });
    }
  }

  // 4. Due dates: charge the month's interest and any annual fee, then pay
  //    what is required to stay current.
  for (const debt of state.debts) {
    if (debtState.dueDateFor(debt, date) !== date) continue;

    const feeCents = debtState.applyAnnualFee(debt, date);
    if (feeCents > 0 && record) {
      record.fees.push({ debtId: debt.id, debtName: debt.name, amountCents: feeCents });
    }

    const interestCents = debtState.accrueMonthlyInterest(debt, date);
    if (interestCents > 0 && record) {
      record.interest.push({ debtId: debt.id, debtName: debt.name, amountCents: interestCents });
    }

    const required = debtState.requiredPaymentCents(debt, interestCents);
    if (required <= 0) continue;

    // The payment is made even when cash does not cover it: the balance is a
    // real obligation, and showing the account going negative is the point.
    // Skipping it would quietly model a missed payment as if it were free.
    const paid = debtState.payRequired(debt, required);
    state.cashCents -= paid;

    if (record) {
      record.payments.push({
        debtId: debt.id,
        debtName: debt.name,
        amountCents: paid,
        kind: 'required',
        aprPercent: debtState.effectiveAprPercent(debt),
        reason: requiredReason(debt)
      });
    }
  }

  // 5. Extra payoff, funded only by cash that stays clear of the floor
  //    through the rest of the plan.
  if (allowExtra && ctx.decisionDays.has(date) && totalOutstandingCents(state) > 0) {
    let budget = clampToZero(surplusAboveFloorCents(ctx, state, date));

    // Repeat so a small debt does not soak up a whole paycheck's surplus.
    let guard = state.debts.length + 1;
    while (budget > 0 && guard > 0 && totalOutstandingCents(state) > 0) {
      guard -= 1;
      const target = chooseExtraTarget(ctx, state, date);
      if (!target) break;

      const owed = debtState.totalBalanceCents(target.debt);
      const amount = Math.min(budget, owed);
      if (amount <= 0) break;

      const paid = debtState.payExtra(target.debt, amount);
      state.cashCents -= paid;
      budget -= paid;

      if (record) {
        record.payments.push({
          debtId: target.debt.id,
          debtName: target.debt.name,
          amountCents: paid,
          kind: 'extra',
          aprPercent: debtState.effectiveAprPercent(target.debt),
          reason: target.reason
        });
      }
    }
  }

  // 6. Note the day each debt clears.
  for (const debt of state.debts) {
    if (!debt.paidOffDate && debtState.totalBalanceCents(debt) <= 0 && debt.startingBalanceCents > 0) {
      debt.paidOffDate = date;
    }
  }

  if (record) record.endCashCents = state.cashCents;
}

function requiredReason(debt) {
  if (!debt.carryingBalance) return 'Statement paid in full, so no interest is charged.';
  if (debt.paymentKind === 'fixed') return 'Contract payment on this loan.';
  if (debt.paymentKind === 'override_min') return 'Statement minimum you entered.';
  return 'Estimated minimum (1% of the balance plus interest, at least $25).';
}

function emptyRecord(date) {
  return {
    date,
    startCashCents: 0,
    endCashCents: 0,
    gains: [],
    charges: [],
    payments: [],
    interest: [],
    fees: [],
    backInterest: []
  };
}

// ---------------------------------------------------------------------------
// Full run
// ---------------------------------------------------------------------------

/**
 * Runs the whole projection.
 *
 * `allowExtra: false` gives the minimum-payments-only baseline, which is what
 * the plan's interest saving is measured against.
 */
function run(ctx, startingCashCents, allowExtra, collectFrom, collectTo) {
  const state = {
    cashCents: startingCashCents,
    debts: ctx.debts.map((debt) => debtState.createDebtState(debt))
  };

  const days = [];
  const months = new Map();
  const alerts = [];

  const collectFromIndex = dates.toDayIndex(collectFrom);
  const collectToIndex = dates.toDayIndex(collectTo);
  const actions = [];
  const seriesDates = [];
  const seriesBalances = state.debts.map(() => []);

  let totalInterestCents = 0;
  let totalPaidCents = 0;
  let totalCardSpendCents = 0;
  let lowestCashCents = startingCashCents;
  let lowestCashDate = ctx.today;
  let firstShortfallDate = null;
  let worstShortfallCents = 0;
  let debtFreeDate = null;

  const startedWithDebt = totalOutstandingCents(state) > 0;
  if (!startedWithDebt) debtFreeDate = ctx.today;

  for (let dayIndex = ctx.startDayIndex; dayIndex <= ctx.endDayIndex; dayIndex += 1) {
    const date = dates.toISO(dayIndex);
    const record = emptyRecord(date);

    stepDay(ctx, state, date, { allowExtra, record });

    // --- running totals -------------------------------------------------
    const interestToday = sumAmounts(record.interest) + sumAmounts(record.backInterest);
    const paidToday = sumAmounts(record.payments);
    const cardSpendToday = record.charges
      .filter((charge) => charge.method === 'card')
      .reduce((sum, charge) => sum + charge.amountCents, 0);

    totalInterestCents += interestToday;
    totalPaidCents += paidToday;
    totalCardSpendCents += cardSpendToday;

    if (state.cashCents < lowestCashCents) {
      lowestCashCents = state.cashCents;
      lowestCashDate = date;
    }

    if (state.cashCents < 0) {
      if (!firstShortfallDate) firstShortfallDate = date;
      worstShortfallCents = Math.max(worstShortfallCents, -state.cashCents);
    }

    if (!debtFreeDate && startedWithDebt && totalOutstandingCents(state) <= 0) {
      debtFreeDate = date;
    }

    // --- month rollup (whole horizon, cheap) ----------------------------
    const key = dates.monthKey(date);
    let month = months.get(key);
    if (!month) {
      month = {
        monthKey: key,
        startCashCents: record.startCashCents,
        endCashCents: state.cashCents,
        lowestCashCents: state.cashCents,
        lowestCashDate: date,
        gainsCents: 0,
        cashChargesCents: 0,
        cardSpendCents: 0,
        paymentsCents: 0,
        interestCents: 0,
        interestByDebt: {},
        hasNegative: false,
        hasBelowFloor: false
      };
      months.set(key, month);
    }
    month.endCashCents = state.cashCents;
    if (state.cashCents < month.lowestCashCents) {
      month.lowestCashCents = state.cashCents;
      month.lowestCashDate = date;
    }
    month.gainsCents += sumAmounts(record.gains);
    month.cashChargesCents += record.charges
      .filter((charge) => charge.method === 'cash')
      .reduce((sum, charge) => sum + charge.amountCents, 0);
    month.cardSpendCents += cardSpendToday;
    month.paymentsCents += paidToday;
    month.interestCents += interestToday;
    for (const entry of record.interest) {
      const id = String(entry.debtId);
      month.interestByDebt[id] = (month.interestByDebt[id] || 0) + entry.amountCents;
    }
    for (const entry of record.backInterest) {
      const id = String(entry.debtId);
      month.interestByDebt[id] = (month.interestByDebt[id] || 0) + entry.amountCents;
    }
    if (state.cashCents < 0) month.hasNegative = true;
    if (state.cashCents >= 0 && state.cashCents < ctx.cashFloorCents) month.hasBelowFloor = true;

    // --- detail for the requested window --------------------------------
    if (dayIndex >= collectFromIndex && dayIndex <= collectToIndex) {
      days.push(serializeDay(record, state, ctx));
    }

    // Extra payoff and routing, through the day the last debt clears. The Plan
    // page shows the next few weeks and a popup lists the rest through payoff.
    if (allowExtra && startedWithDebt && (!debtFreeDate || date === debtFreeDate)) {
      collectActions(actions, record);
    }

    // Balance-over-time for the line chart: weekly, plus the days money
    // actually moves, so avalanche drops are not smoothed away.
    if (allowExtra && startedWithDebt && (!debtFreeDate || date === debtFreeDate)) {
      const extraToday = record.payments.some((payment) => payment.kind === 'extra' && payment.amountCents > 0);
      const paidOffToday = state.debts.some((debt) => debt.paidOffDate === date);
      const weekTick = (dayIndex - ctx.startDayIndex) % 7 === 0;
      if ((weekTick || extraToday || paidOffToday || date === debtFreeDate)
          && seriesDates[seriesDates.length - 1] !== date) {
        seriesDates.push(date);
        state.debts.forEach((debt, index) => {
          seriesBalances[index].push(toDollars(debtState.totalBalanceCents(debt)));
        });
      }
    }

    // --- alerts worth a banner, over the whole horizon ------------------
    collectAlerts(alerts, record, state, ctx);

    // Stop once there is nothing left to model and the calendar has its data.
    if (totalOutstandingCents(state) <= 0 && dayIndex >= collectToIndex) break;
  }

  return {
    days,
    months: [...months.values()],
    alerts,
    actions,
    debtSeries: {
      dates: seriesDates,
      series: state.debts.map((debt, index) => ({
        id: debt.id,
        name: debt.name,
        balances: seriesBalances[index]
      }))
    },
    interestSeries: serializeInterestSeries(
      months,
      state.debts,
      ctx.today,
      debtFreeDate
    ),
    debts: state.debts.map((debt) => serializeDebt(debt, ctx)),
    endCashCents: state.cashCents,
    summary: {
      startingCashCents,
      totalInterestCents,
      totalPaidCents,
      totalCardSpendCents,
      lowestCashCents,
      lowestCashDate,
      firstShortfallDate,
      worstShortfallCents,
      debtFreeDate,
      remainingDebtCents: totalOutstandingCents(state)
    }
  };
}

function serializeInterestSeries(monthsMap, debts, today, debtFreeDate) {
  const startKey = dates.monthKey(today);
  const endKey = dates.monthKey(
    debtFreeDate ? dates.addMonths(debtFreeDate, 1) : dates.addMonths(today, 1)
  );

  const months = [...monthsMap.values()].filter(
    (month) => month.monthKey >= startKey && month.monthKey <= endKey
  );

  // The payoff month still charges a last scrap of interest on the due date.
  // One empty month after it is what makes the stack visibly hit $0.
  if (debtFreeDate) {
    const trailing = dates.monthKey(dates.addMonths(debtFreeDate, 1));
    if (!months.some((month) => month.monthKey === trailing)) {
      months.push({ monthKey: trailing, interestByDebt: {} });
    }
  }

  return {
    months: months.map((month) => month.monthKey),
    series: debts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      amounts: months.map((month) => toDollars((month.interestByDebt || {})[String(debt.id)] || 0))
    }))
  };
}

function sumAmounts(list) {
  return list.reduce((sum, item) => sum + item.amountCents, 0);
}

function serializeDay(record, state, ctx) {
  const gainsCents = sumAmounts(record.gains);
  const cashChargesCents = record.charges
    .filter((charge) => charge.method === 'cash')
    .reduce((sum, charge) => sum + charge.amountCents, 0);
  const cardSpendCents = record.charges
    .filter((charge) => charge.method === 'card')
    .reduce((sum, charge) => sum + charge.amountCents, 0);
  const paymentsCents = sumAmounts(record.payments);

  return {
    date: record.date,
    startCash: toDollars(record.startCashCents),
    endCash: toDollars(record.endCashCents),
    gains: gainsCents === 0 ? 0 : toDollars(gainsCents),
    cashCharges: toDollars(cashChargesCents),
    cardSpend: toDollars(cardSpendCents),
    payments: toDollars(paymentsCents),
    interest: toDollars(sumAmounts(record.interest) + sumAmounts(record.backInterest)),
    net: toDollars(record.endCashCents - record.startCashCents),
    negative: record.endCashCents < 0,
    belowFloor: record.endCashCents >= 0 && record.endCashCents < ctx.cashFloorCents,
    items: [
      ...record.gains.map((gain) => ({
        kind: 'gain',
        name: gain.name,
        amount: toDollars(gain.amountCents)
      })),
      ...record.charges.map((charge) => ({
        kind: 'charge',
        name: charge.name,
        amount: toDollars(charge.amountCents),
        method: charge.method,
        debtId: charge.debtId,
        debtName: charge.debtName,
        pinned: charge.pinned,
        overLimit: charge.overLimit,
        optimized: charge.optimized,
        reason: charge.reason
      })),
      ...record.payments.map((payment) => ({
        kind: payment.kind === 'extra' ? 'extra_payment' : 'required_payment',
        name: payment.debtName,
        amount: toDollars(payment.amountCents),
        debtId: payment.debtId,
        aprPercent: payment.aprPercent,
        reason: payment.reason
      })),
      ...record.fees.map((fee) => ({
        kind: 'fee',
        name: `${fee.debtName} annual fee`,
        amount: toDollars(fee.amountCents),
        debtId: fee.debtId
      })),
      ...record.interest.map((entry) => ({
        kind: 'interest',
        name: `${entry.debtName} interest`,
        amount: toDollars(entry.amountCents),
        debtId: entry.debtId
      })),
      ...record.backInterest.map((entry) => ({
        kind: 'back_interest',
        name: `${entry.debtName} deferred interest charged`,
        amount: toDollars(entry.amountCents),
        debtId: entry.debtId
      }))
    ]
  };
}

function serializeDebt(debt, ctx) {
  return {
    id: debt.id,
    name: debt.name,
    projectedBalance: toDollars(debtState.totalBalanceCents(debt)),
    startingBalance: toDollars(debt.startingBalanceCents),
    effectiveApr: debtState.effectiveAprPercent(debt),
    estimatedMinimum: toDollars(debtState.estimatedMinimumCents(debt)),
    availableCredit: debt.creditLimitCents === null
      ? null
      : toDollars(debtState.availableCreditCents(debt)),
    interestCharged: toDollars(debt.interestChargedCents),
    totalPaid: toDollars(debt.paidCents),
    newSpend: toDollars(debt.newSpendCents),
    paidOffDate: debt.paidOffDate,
    purchaseApr: debtState.purchaseApr(debt, ctx.today),
    buckets: debt.buckets
      .filter((bucket) => bucket.balanceCents > 0)
      .map((bucket) => ({
        kind: bucket.key,
        apr: bucket.apr,
        balance: toDollars(bucket.balanceCents),
        endDate: bucket.endDate,
        isDeferred: bucket.isDeferred,
        pendingBackInterest: toDollars(bucket.deferredAccruedCents)
      }))
  };
}

function collectActions(actions, record) {
  for (const payment of record.payments) {
    if (payment.kind !== 'extra' || payment.amountCents <= 0) continue;
    actions.push({
      date: record.date,
      kind: 'extra_payment',
      name: payment.debtName,
      debtId: payment.debtId,
      debtName: payment.debtName,
      title: `Pay ${formatDollars(payment.amountCents)} extra to ${payment.debtName}`,
      detail: payment.reason,
      amount: toDollars(payment.amountCents)
    });
  }

  for (const charge of record.charges) {
    if (!charge.optimized) continue;
    actions.push({
      date: record.date,
      kind: charge.method === 'card' ? 'route_to_card' : 'route_to_cash',
      name: charge.name,
      debtId: charge.debtId,
      debtName: charge.debtName,
      title: charge.method === 'card'
        ? `Put ${charge.name} (${formatDollars(charge.amountCents)}) on ${charge.debtName}`
        : `Pay ${charge.name} (${formatDollars(charge.amountCents)}) with cash`,
      detail: charge.reason,
      amount: toDollars(charge.amountCents)
    });
  }
}

function collectAlerts(alerts, record, state, ctx) {
  const has = (type, date) =>
    alerts.some((alert) => alert.type === type && alert.date === date);

  if (state.cashCents < 0 && !has('shortfall', record.date)) {
    alerts.push({
      type: 'shortfall',
      date: record.date,
      amount: toDollars(-state.cashCents)
    });
  } else if (
    state.cashCents >= 0 &&
    state.cashCents < ctx.cashFloorCents &&
    !has('below_floor', record.date)
  ) {
    alerts.push({
      type: 'below_floor',
      date: record.date,
      amount: toDollars(state.cashCents)
    });
  }

  for (const charge of record.charges) {
    if (!charge.overLimit) continue;
    alerts.push({
      type: 'over_limit',
      date: record.date,
      debtId: charge.debtId,
      debtName: charge.debtName,
      name: charge.name,
      amount: toDollars(charge.amountCents)
    });
  }

  for (const entry of record.backInterest) {
    alerts.push({
      type: 'deferred_interest_charged',
      date: record.date,
      debtId: entry.debtId,
      debtName: entry.debtName,
      amount: toDollars(entry.amountCents)
    });
  }
}

function formatDollars(cents) {
  const dollars = Math.abs(cents) / 100;
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
  return `${cents < 0 ? '-' : ''}$${formatted}`;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {string}  input.today          'YYYY-MM-DD' in the user's own timezone
 * @param {number}  input.cashFloor      dollars the plan tries to stay above
 * @param {string}  input.strategy       'optimized' | 'snowball'
 * @param {number}  input.horizonMonths  how far to project (1-60)
 * @param {Array}   input.debts          debt rows, each with a `promos` array
 * @param {Array}   input.events         gain/charge rows
 * @param {string} [input.windowFrom]    first day of full detail
 * @param {string} [input.windowTo]      last day of full detail
 */
function project(input) {
  const today = input.today;
  const horizonMonths = Math.min(Math.max(Number(input.horizonMonths) || DEFAULT_HORIZON_MONTHS, 1), 60);
  const cashFloorCents = toCents(input.cashFloor);
  const strategy = input.strategy === 'snowball' ? 'snowball' : 'optimized';

  const endDate = dates.addMonths(today, horizonMonths);

  // Default detail window: the calendar month around today, plus a month either
  // side so paging is instant.
  const windowFrom = input.windowFrom || dates.startOfMonth(dates.addMonths(today, -1));
  const windowTo = input.windowTo || dates.endOfMonth(dates.addMonths(today, 1));

  // The initial deposit is the answer to "how much cash do I have right now",
  // so once its date has passed it is the opening balance rather than a future
  // gain. Dated ahead, it stays an ordinary one-time gain.
  const initial = input.events.find((event) => event.isInitialDeposit);
  const initialIsHistory = initial && dates.toDayIndex(initial.startDate) <= dates.toDayIndex(today);
  const startingCashCents = initialIsHistory ? toCents(initial.amount) : 0;

  const activeEvents = input.events.filter((event) => !(initialIsHistory && event.isInitialDeposit));

  // Index through the horizon (and one extra day) so surplus probes and the
  // main walk see the same gains and charges.
  const occurrences = buildOccurrenceMap(activeEvents, today, dates.addDays(endDate, 1));

  // Extra payments are decided on paydays, when money has just landed, plus
  // day one so existing cash is put to work immediately.
  const decisionDays = new Set([today]);
  for (const [date, list] of occurrences) {
    if (list.some((event) => event.direction === 'gain')) decisionDays.add(date);
  }

  const ctx = {
    today,
    endDate,
    startDayIndex: dates.toDayIndex(today),
    endDayIndex: dates.toDayIndex(endDate),
    cashFloorCents,
    strategy,
    debts: input.debts,
    occurrences,
    decisionDays
  };

  const plan = run(ctx, startingCashCents, true, windowFrom, windowTo);

  // Minimums-only baseline, for "here is what the plan is worth".
  const baseline = run(ctx, startingCashCents, false, today, today);

  const totalDebtCents = input.debts.reduce((sum, debt) => sum + toCents(debt.balance), 0);

  return {
    today,
    window: { from: windowFrom, to: windowTo },
    horizonMonths,
    cashFloor: toDollars(cashFloorCents),
    strategy,
    assumption: 'Interest is compounded monthly and charged on each due date.',
    summary: {
      cashOnHand: toDollars(startingCashCents),
      totalDebt: toDollars(totalDebtCents),
      debtFreeDate: plan.summary.debtFreeDate,
      monthsToDebtFree: plan.summary.debtFreeDate
        ? Math.max(0, Math.round(dates.daysBetween(today, plan.summary.debtFreeDate) / 30.44))
        : null,
      remainingDebtAtHorizon: toDollars(plan.summary.remainingDebtCents),
      interestRemaining: toDollars(plan.summary.totalInterestCents),
      totalPaid: toDollars(plan.summary.totalPaidCents),
      newCardSpend: toDollars(plan.summary.totalCardSpendCents),
      lowestCash: toDollars(plan.summary.lowestCashCents),
      lowestCashDate: plan.summary.lowestCashDate,
      firstShortfallDate: plan.summary.firstShortfallDate,
      worstShortfall: toDollars(plan.summary.worstShortfallCents),
      minimumsOnly: {
        debtFreeDate: baseline.summary.debtFreeDate,
        interestRemaining: toDollars(baseline.summary.totalInterestCents)
      },
      interestSaved: toDollars(
        Math.max(0, baseline.summary.totalInterestCents - plan.summary.totalInterestCents)
      ),
      monthsSaved: monthsBetweenDates(plan.summary.debtFreeDate, baseline.summary.debtFreeDate)
    },
    banners: buildBanners(plan, cashFloorCents),
    days: plan.days,
    months: plan.months,
    actions: plan.actions,
    debts: plan.debts,
    debtSeries: plan.debtSeries,
    interestSeries: plan.interestSeries,
    reserveWindowDays: dates.daysBetween(today, endDate),
    nearTermDays: NEAR_TERM_DAYS
  };
}

function monthsBetweenDates(earlier, later) {
  if (!earlier || !later) return null;
  const days = dates.daysBetween(earlier, later);
  return days <= 0 ? 0 : Math.round(days / 30.44);
}

/**
 * Turns raw alerts into the handful of messages worth putting at the top.
 * A shortfall matters far more than a dip below a soft floor, so only the
 * most severe of each kind is surfaced, with its first date.
 */
function buildBanners(plan, cashFloorCents) {
  const banners = [];

  const shortfalls = plan.alerts.filter((alert) => alert.type === 'shortfall');
  if (shortfalls.length > 0) {
    const worst = shortfalls.reduce((a, b) => (b.amount > a.amount ? b : a));
    banners.push({
      level: 'critical',
      title: 'Cash runs out',
      message: `Short ${formatMoney(worst.amount)} on ${shortfalls[0].date}. Required bills and minimum payments already use every dollar, and no extra payoff is scheduled before then.`,
      date: shortfalls[0].date,
      actions: [
        'Add a one-time gain',
        'Reduce or move a charge',
        'Put an eligible charge on a 0% purchase card'
      ]
    });
  }

  const belowFloor = plan.alerts.filter((alert) => alert.type === 'below_floor');
  if (belowFloor.length > 0 && cashFloorCents > 0) {
    banners.push({
      level: 'warning',
      title: 'Below your cash floor',
      message: `Cash stays above $0 but dips under your ${formatMoney(toDollars(cashFloorCents))} floor on ${belowFloor[0].date}. No extra payoff is scheduled while you are under it.`,
      date: belowFloor[0].date
    });
  }

  const overLimit = plan.alerts.filter((alert) => alert.type === 'over_limit');
  if (overLimit.length > 0) {
    const first = overLimit[0];
    banners.push({
      level: 'warning',
      title: 'Charge exceeds a credit limit',
      message: `${first.name} (${formatMoney(first.amount)}) is pinned to ${first.debtName} on ${first.date}, which has no room left. The pin was kept — move it or raise the limit.`,
      date: first.date
    });
  }

  const deferred = plan.alerts.filter((alert) => alert.type === 'deferred_interest_charged');
  if (deferred.length > 0) {
    const first = deferred[0];
    banners.push({
      level: 'critical',
      title: 'Deferred interest will be charged',
      message: `${first.debtName} still has a balance at its deferred-interest deadline, so ${formatMoney(first.amount)} of back-interest lands on ${first.date}.`,
      date: first.date
    });
  }

  return banners;
}

function formatMoney(dollars) {
  return `$${Number(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

module.exports = { project, NEAR_TERM_DAYS };
