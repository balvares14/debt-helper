/**
 * Engine self-check. No database, no server.
 *
 * Runs the demo plan and asserts the rules that are easy to get wrong and
 * expensive to get wrong quietly:
 *   - never route ordinary spend onto a high-APR card that is already carrying
 *   - never pay extra at debt if it makes a later day go negative
 *   - never pay extra while below the cash floor
 *   - required payments keep happening, and the debts actually clear
 *
 * Usage: npm run check-engine
 */

const engine = require('../services/planner/engine');
const dates = require('../services/planner/dates');
const { buildDemoPlan } = require('../services/planner/demoData');

let failures = 0;

function check(label, passed, detail) {
  const mark = passed ? '✓' : '✗';
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures += 1;
}

/** Demo data is shaped for the repository; the engine wants one flat event
 *  list. Opening cash is just a dated one-time gain. */
function toEngineInput(demo, today, overrides = {}) {
  const debts = demo.debts.map((debt, index) => ({
    ...debt,
    id: index + 1,
    fixedPayment: debt.fixedPayment ?? null,
    overrideMin: null,
    annualFee: debt.annualFee ?? 0,
    annualFeeMonth: null,
    promos: (debt.promos || []).map((promo, promoIndex) => ({
      ...promo,
      id: (index + 1) * 10 + promoIndex
    }))
  }));

  const events = [
    {
      id: 100,
      name: demo.initialCash.name,
      amount: demo.initialCash.amount,
      direction: 'gain',
      startDate: demo.initialCash.date,
      cadence: 'one_time',
      endDate: null,
      canPutOnCard: false,
      paymentMethod: 'cash',
      paymentDebtId: null,
      locked: false
    },
    ...demo.events.map((event, index) => ({
      id: 200 + index,
      endDate: null,
      paymentDebtId: null,
      locked: false,
      ...event
    }))
  ];

  return {
    today,
    cashFloor: demo.settings.cashFloor,
    strategy: demo.settings.strategy,
    horizonMonths: demo.settings.horizonMonths,
    debts,
    events,
    // Collect a full year of daily detail so the assertions have data to read.
    windowFrom: today,
    windowTo: dates.addMonths(today, 12),
    ...overrides
  };
}

const today = '2026-09-15';
const demo = buildDemoPlan(today);
const input = toEngineInput(demo, today);

console.time('projection');
const result = engine.project(input);
console.timeEnd('projection');

const byName = (name) => result.debts.find((debt) => debt.name === name);
const cardB = byName('Card B');
const cardC = byName('Card C');
const loan = byName('Auto loan');

console.log('\nSummary');
console.log(`  cash on hand      ${result.summary.cashOnHand}`);
console.log(`  total debt        ${result.summary.totalDebt}`);
console.log(`  debt-free         ${result.summary.debtFreeDate} (${result.summary.monthsToDebtFree} months)`);
console.log(`  interest paid     ${result.summary.interestRemaining}`);
console.log(`  minimums only     ${result.summary.minimumsOnly.debtFreeDate}, interest ${result.summary.minimumsOnly.interestRemaining}`);
console.log(`  interest saved    ${result.summary.interestSaved} (${result.summary.monthsSaved} months sooner)`);
console.log(`  lowest cash       ${result.summary.lowestCash} on ${result.summary.lowestCashDate}`);
console.log(`  first shortfall   ${result.summary.firstShortfallDate ?? 'none'}`);

console.log('\nBanners');
if (result.banners.length === 0) console.log('  (none)');
result.banners.forEach((banner) => console.log(`  [${banner.level}] ${banner.title}: ${banner.message}`));

console.log('\nFirst 8 recommended actions');
result.actions.slice(0, 8).forEach((action) => {
  console.log(`  ${action.date}  ${action.title}`);
  console.log(`            ${action.detail}`);
});

// -------------------------------------------------------------------------
// Routing
// -------------------------------------------------------------------------
console.log('\nRouting rules');

const groceryCharges = result.days.flatMap((day) =>
  day.items
    .filter((item) => item.kind === 'charge' && item.name === 'Groceries')
    .map((item) => ({ date: day.date, ...item }))
);

const onCardB = groceryCharges.filter((charge) => charge.debtName === 'Card B');
check(
  'groceries never go on Card B (29.99%, already carrying)',
  onCardB.length === 0,
  onCardB.length > 0 ? `${onCardB.length} landed there, first on ${onCardB[0].date}` : undefined
);

const promoEnd = dates.addMonths(today, 6);
const duringPromo = groceryCharges.filter((charge) => charge.date <= promoEnd);
const onCardCDuringPromo = duringPromo.filter((charge) => charge.debtName === 'Card C');
check(
  'groceries use Card C while its 0% purchase promo is open',
  onCardCDuringPromo.length > 0,
  `${onCardCDuringPromo.length} of ${duringPromo.length} during the promo`
);

// The exceptions are legitimate: Card C's $4,000 limit fills up, and a full
// 0% card is no longer an option. What matters is that the fallback is cash
// and that the explanation says so rather than claiming there is no promo.
const promoExceptions = duringPromo.filter((charge) => charge.debtName !== 'Card C');
check(
  'when Card C is full, groceries fall back to cash and say why',
  promoExceptions.every(
    (charge) => charge.method === 'cash' && charge.reason.includes('no room left')
  ),
  `${promoExceptions.length} exception(s)${promoExceptions[0] ? `: "${promoExceptions[0].reason}"` : ''}`
);

const afterPromo = groceryCharges.filter((charge) => charge.date > promoEnd);
const cashAfterPromo = afterPromo.filter((charge) => charge.method === 'cash');
check(
  'groceries fall back to cash once the promo ends',
  afterPromo.length === 0 || cashAfterPromo.length === afterPromo.length,
  `${cashAfterPromo.length} of ${afterPromo.length} after ${promoEnd}`
);

// -------------------------------------------------------------------------
// Cash rules
// -------------------------------------------------------------------------
console.log('\nCash rules');

const negativeDays = result.days.filter((day) => day.negative);
check(
  'cash never goes negative in the first year',
  negativeDays.length === 0,
  negativeDays.length > 0
    ? `${negativeDays.length} days, first ${negativeDays[0].date} at ${negativeDays[0].endCash}`
    : undefined
);

const extraPayments = result.days.flatMap((day) =>
  day.items
    .filter((item) => item.kind === 'extra_payment' && item.amount > 0)
    .map((item) => ({ date: day.date, endCash: day.endCash, ...item }))
);

const extrasBelowFloor = extraPayments.filter((payment) => payment.endCash < result.cashFloor);
check(
  'no extra payoff on a day that ends below the cash floor',
  extrasBelowFloor.length === 0,
  extrasBelowFloor.length > 0
    ? `${extrasBelowFloor.length}, first ${extrasBelowFloor[0].date} ending at ${extrasBelowFloor[0].endCash}`
    : undefined
);

// Rent is the trap: paying extra right before it is due must not starve it.
const rentDays = result.days.filter((day) =>
  day.items.some((item) => item.kind === 'charge' && item.name === 'Rent')
);
const rentPaidFromCash = rentDays.every((day) =>
  day.items.some((item) => item.kind === 'charge' && item.name === 'Rent' && item.method === 'cash')
);
check('rent is always paid from cash', rentPaidFromCash, `${rentDays.length} rent days`);
check(
  'account never ends a rent day negative',
  rentDays.every((day) => day.endCash >= 0),
  rentDays.filter((day) => day.endCash < 0).map((day) => day.date).join(', ') || undefined
);

// -------------------------------------------------------------------------
// Payoff behaviour
// -------------------------------------------------------------------------
console.log('\nPayoff behaviour');

check(
  'extra payoff is actually happening',
  extraPayments.length > 0,
  `${extraPayments.length} extra payments in the first year`
);

const firstExtra = extraPayments[0];
check(
  'the first extra payment targets the highest-rate debt (Card B)',
  !!firstExtra && firstExtra.name === 'Card B',
  firstExtra ? `${firstExtra.date} → ${firstExtra.name} ${firstExtra.amount}` : 'none found'
);

const lastAction = result.actions[result.actions.length - 1];
const nearTermEnd = dates.addDays(today, result.nearTermDays || 45);
check(
  'the action list continues past the next few weeks through payoff',
  result.actions.some((action) => action.date > nearTermEnd),
  lastAction ? `${result.actions.length} steps, last ${lastAction.date}` : 'none'
);
check(
  'actions stop once every debt is clear',
  !!result.summary.debtFreeDate && (!lastAction || lastAction.date <= result.summary.debtFreeDate),
  lastAction && result.summary.debtFreeDate
    ? `last ${lastAction.date}, debt-free ${result.summary.debtFreeDate}`
    : undefined
);

check('every debt is projected to reach $0', result.debts.every((debt) => !!debt.paidOffDate),
  result.debts.map((debt) => `${debt.name}: ${debt.paidOffDate ?? 'never'}`).join(', '));

const cardBSeries = result.debtSeries.series.find((line) => line.name === 'Card B');
const cardCSeries = result.debtSeries.series.find((line) => line.name === 'Card C');
const lastDate = result.debtSeries.dates[result.debtSeries.dates.length - 1];
check(
  'the balance chart samples through debt-free',
  result.debtSeries.dates.length > 8 && lastDate === result.summary.debtFreeDate,
  `${result.debtSeries.dates.length} points, last ${lastDate}`
);
check(
  'Card B hits $0 on the chart before Card C',
  !!cardBSeries && !!cardCSeries
    && cardBSeries.balances.findIndex((b) => b === 0) < cardCSeries.balances.findIndex((b) => b === 0)
    && cardBSeries.balances.findIndex((b) => b === 0) >= 0,
  `B zero at sample ${cardBSeries?.balances.findIndex((b) => b === 0)}, C at ${cardCSeries?.balances.findIndex((b) => b === 0)}`
);

const lastInterestMonth = result.interestSeries.months[result.interestSeries.months.length - 1];
const lastInterestTotal = result.interestSeries.series.reduce(
  (sum, line) => sum + (line.amounts[line.amounts.length - 1] || 0),
  0
);
check(
  'monthly interest is tracked per debt through payoff',
  result.interestSeries.months.length > 6 && result.interestSeries.series.length === 3,
  `${result.interestSeries.months.length} months, ${result.interestSeries.series.length} debts`
);
check(
  'interest charged drops to $0 in the last month of the plan',
  lastInterestTotal === 0,
  `last ${lastInterestMonth} total ${lastInterestTotal}`
);

check(
  'the plan beats minimum payments on interest',
  result.summary.interestSaved > 0,
  `saved ${result.summary.interestSaved}`
);

check(
  'the loan keeps its fixed contract payment',
  result.days.some((day) =>
    day.items.some(
      (item) =>
        item.kind === 'required_payment' && item.name === 'Auto loan' && item.amount === 310
    )
  ),
  'expected a $310 required payment'
);

check(
  "Card C's transferred balance stays at 0% until its promo ends",
  (cardC.buckets.find((bucket) => bucket.kind === 'existing_balance') ?? { apr: 0 }).apr === 0
    || cardC.projectedBalance === 0,
  `Card C projected balance ${cardC.projectedBalance}`
);

// -------------------------------------------------------------------------
// Snowball should change the order, not the cash rules
// -------------------------------------------------------------------------
console.log('\nSnowball strategy');

const snowball = engine.project(toEngineInput(demo, today, { strategy: 'snowball' }));
const snowballExtras = snowball.days.flatMap((day) =>
  day.items.filter((item) => item.kind === 'extra_payment')
);

check(
  'snowball attacks the smallest balance first (Card C)',
  snowballExtras.length > 0 && snowballExtras[0].name === 'Card C',
  snowballExtras[0] ? `first extra → ${snowballExtras[0].name}` : 'none'
);
check(
  'snowball still never goes negative',
  snowball.days.every((day) => !day.negative)
);
check(
  'snowball costs more interest than optimized (or ties)',
  snowball.summary.interestRemaining >= result.summary.interestRemaining,
  `snowball ${snowball.summary.interestRemaining} vs optimized ${result.summary.interestRemaining}`
);

// -------------------------------------------------------------------------
// A deliberate shortfall must be reported, not hidden
// -------------------------------------------------------------------------
console.log('\nShortfall reporting');

const broke = engine.project(
  toEngineInput(demo, today, {
    events: toEngineInput(demo, today).events.map((event) =>
      event.name === 'Paycheck' ? { ...event, amount: 200 } : event
    )
  })
);

check(
  'a plan that cannot work reports a shortfall',
  !!broke.summary.firstShortfallDate,
  `first shortfall ${broke.summary.firstShortfallDate ?? 'none'}`
);
check(
  'and raises a critical banner',
  broke.banners.some((banner) => banner.level === 'critical'),
  broke.banners.map((banner) => banner.title).join(', ')
);
check(
  'and schedules no extra payoff it cannot afford',
  broke.days.every((day) => !day.items.some((item) => item.kind === 'extra_payment' && day.endCash < 0))
);

console.log('\nEvent start vs hit day');

const monthlyHits = dates.occurrencesBetween(
  { startDate: '2026-10-14', cadence: 'monthly', dueDate: '2026-01-01' },
  '2026-10-01',
  '2026-12-31'
);
check(
  'a monthly gain starting mid-month hits the next 1st, not the 1st already passed',
  monthlyHits[0] === '2026-11-01' && !monthlyHits.includes('2026-10-01'),
  monthlyHits.join(', ')
);

const weeklyHits = dates.occurrencesBetween(
  { startDate: '2026-10-14', cadence: 'weekly', dueDate: '2026-10-19' },
  '2026-10-14',
  '2026-11-02'
);
check(
  'a weekly charge starting Wednesday hits the next Monday, not before the start',
  weeklyHits[0] === '2026-10-19' && !weeklyHits.includes('2026-10-12'),
  weeklyHits.join(', ')
);

const fromDue = dates.occurrencesBetween(
  { startDate: '2026-01-01', cadence: 'monthly', dueDate: '2026-11-01' },
  '2026-01-01',
  '2026-12-31'
);
check(
  'monthly copies start at the due date, not earlier months after the start date',
  fromDue[0] === '2026-11-01' && !fromDue.includes('2026-10-01'),
  fromDue.join(', ')
);

// A gain dated before today must still be cash on hand. There is no separate
// "cash on hand" deposit — leftover is just the ledger.
console.log('\nHistory cash');

const historyToday = '2026-10-14';
const history = engine.project({
  today: historyToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: '2026-10-13',
  windowTo: '2026-10-20',
  debts: [],
  events: [
    {
      id: 1,
      name: 'Initial cash',
      amount: 1900,
      direction: 'gain',
      startDate: '2026-10-13',
      cadence: 'one_time',
      paymentMethod: 'cash',
      canPutOnCard: false,
      paymentDebtId: null,
      locked: false
    }
  ]
});

check(
  'a gain yesterday is still cash on hand when nothing is dated today',
  history.summary.cashOnHand === 1900,
  `cash on hand ${history.summary.cashOnHand}`
);

const oct14 = history.days.find((day) => day.date === historyToday);
check(
  'today opens with that leftover, not 0',
  oct14 ? oct14.startCash === 1900 && oct14.endCash === 1900 : false,
  oct14 ? `start ${oct14.startCash}, end ${oct14.endCash}` : 'today missing'
);

const emptyToday = engine.project({
  today: historyToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 1,
  windowFrom: historyToday,
  windowTo: historyToday,
  debts: [],
  events: []
});
check(
  'with no dated gains at all, cash on hand is 0',
  emptyToday.summary.cashOnHand === 0,
  `cash on hand ${emptyToday.summary.cashOnHand}`
);

console.log('\nDebt start date');

const futureStart = engine.project({
  today: '2026-10-14',
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 3,
  windowFrom: '2026-10-14',
  windowTo: '2026-12-31',
  debts: [
    {
      id: 1,
      name: 'New loan',
      debtType: 'loan',
      balance: 3000,
      apr: 9,
      startDate: '2026-11-20',
      dueDay: 12,
      paymentKind: 'fixed',
      fixedPayment: 150,
      acceptsNewCharges: false,
      creditLimit: null,
      carryingBalance: true,
      annualFee: 0,
      promos: []
    }
  ],
  events: [
    {
      id: 1,
      name: 'Initial cash',
      amount: 2000,
      direction: 'gain',
      startDate: '2026-10-13',
      cadence: 'one_time',
      paymentMethod: 'cash',
      canPutOnCard: false,
      paymentDebtId: null,
      locked: false
    }
  ]
});

const requiredOn = (date) => {
  const day = futureStart.days.find((entry) => entry.date === date);
  return day
    ? day.items.filter((item) => item.kind === 'required_payment' && item.name === 'New loan')
    : [];
};

check(
  'a debt does not take a required payment before its start date',
  requiredOn('2026-11-12').length === 0,
  requiredOn('2026-11-12').length > 0 ? 'Nov 12 fired too early' : 'Nov 12 skipped'
);
check(
  'the first due is the first due day on or after the start date',
  requiredOn('2026-12-12').length === 1 && requiredOn('2026-12-12')[0].amount === 150,
  requiredOn('2026-12-12')[0]
    ? `Dec 12 paid ${requiredOn('2026-12-12')[0].amount}`
    : 'Dec 12 missing'
);
check(
  'extra payoff does not target a debt before it starts',
  !futureStart.days.some(
    (day) =>
      day.date < '2026-11-20' &&
      day.items.some((item) => item.kind === 'extra_payment' && item.name === 'New loan')
  )
);

// Extra after this month's due date used to look only 45 days ahead, so a
// cash bill ~46 days later was spent as surplus. The probe now walks the
// whole plan horizon.
console.log('\nReserve window');

const afterDue = engine.project({
  today: '2026-09-16',
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 6,
  windowFrom: '2026-09-16',
  windowTo: '2026-12-31',
  debts: [
    {
      id: 1,
      name: 'Card A',
      debtType: 'credit_card',
      balance: 2500,
      apr: 24.99,
      dueDay: 15,
      paymentKind: 'estimated_min',
      acceptsNewCharges: true,
      creditLimit: 5000,
      carryingBalance: true,
      annualFee: 0,
      promos: []
    }
  ],
  events: [
    {
      id: 10,
      name: 'Cash',
      amount: 850,
      direction: 'gain',
      startDate: '2026-01-01',
      cadence: 'one_time',
      paymentMethod: 'cash',
      canPutOnCard: false,
      paymentDebtId: null,
      locked: false
    },
    {
      id: 11,
      name: 'Bill',
      amount: 400,
      direction: 'charge',
      startDate: '2026-11-01',
      cadence: 'one_time',
      paymentMethod: 'cash',
      canPutOnCard: false,
      paymentDebtId: null,
      locked: false
    }
  ]
});

const afterDueExtra = afterDue.days.flatMap((day) =>
  day.items.filter((item) => item.kind === 'extra_payment')
);
const nov1 = afterDue.days.find((day) => day.date === '2026-11-01');

check(
  'extra after a due date still reserves a cash bill 46 days later',
  nov1 ? nov1.endCash >= 0 : false,
  nov1 ? `Nov 1 ends at ${nov1.endCash}` : 'Nov 1 missing'
);
check(
  'and does not spend that bill as extra payoff',
  afterDueExtra.length === 0 || afterDueExtra[0].amount <= 850 - 400,
  afterDueExtra[0] ? `first extra ${afterDueExtra[0].amount}` : 'no extra'
);

// -------------------------------------------------------------------------
// Deferred interest has to jump the queue
// -------------------------------------------------------------------------
console.log('\nDeferred interest');

const deferredDemo = buildDemoPlan(today);
deferredDemo.debts.push({
  name: 'Furniture (deferred)',
  debtType: 'credit_card',
  balance: 2000,
  apr: 27.99,
  dueDay: 15,
  paymentKind: 'estimated_min',
  acceptsNewCharges: false,
  creditLimit: 3000,
  carryingBalance: true,
  annualFee: 0,
  promos: [
    {
      kind: 'deferred_interest',
      apr: 0,
      appliesToAmount: 2000,
      endDate: dates.addMonths(today, 8)
    }
  ]
});

const deferred = engine.project(toEngineInput(deferredDemo, today));
const deferredExtras = deferred.days.flatMap((day) =>
  day.items.filter((item) => item.kind === 'extra_payment')
);
const furniture = deferred.debts.find((debt) => debt.name === 'Furniture (deferred)');

check(
  'surplus goes to the deferred-interest balance first, despite its 0% rate',
  deferredExtras.length > 0 && deferredExtras[0].name === 'Furniture (deferred)',
  deferredExtras[0] ? `first extra → ${deferredExtras[0].name}` : 'none'
);
check(
  'and it is cleared before the drop-dead date',
  !!furniture.paidOffDate && furniture.paidOffDate <= dates.addMonths(today, 8),
  `paid off ${furniture.paidOffDate ?? 'never'}, deadline ${dates.addMonths(today, 8)}`
);
check(
  'so no back-interest is ever charged',
  !deferred.banners.some((banner) => banner.title === 'Deferred interest will be charged')
);

console.log('\nDay reviews');

const reviewToday = '2026-10-14';
const skippedGain = engine.project({
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: '2026-10-13',
  windowTo: reviewToday,
  debts: [],
  events: [
    {
      id: 1,
      name: 'Initial cash',
      amount: 1900,
      direction: 'gain',
      startDate: '2026-10-13',
      cadence: 'one_time',
      paymentMethod: 'cash',
      canPutOnCard: false,
      paymentDebtId: null,
      locked: false
    }
  ],
  actuals: [{ date: '2026-10-13', itemKey: 'gain:event:1', status: 'skipped' }]
});
check(
  'skipping yesterday\'s gain leaves cash on hand at 0',
  skippedGain.summary.cashOnHand === 0,
  `cash on hand ${skippedGain.summary.cashOnHand}`
);

const reviewDebts = [
  {
    id: 1,
    name: 'High APR',
    debtType: 'credit_card',
    balance: 4000,
    apr: 29.99,
    startDate: '2026-01-01',
    cadence: 'monthly',
    dueDate: '2026-11-01',
    paymentKind: 'estimated_min',
    acceptsNewCharges: false,
    creditLimit: 5000,
    carryingBalance: true,
    annualFee: 0,
    balanceAsOf: reviewToday,
    promos: []
  },
  {
    id: 2,
    name: 'Low APR',
    debtType: 'credit_card',
    balance: 4000,
    apr: 9.99,
    startDate: '2026-01-01',
    cadence: 'monthly',
    dueDate: '2026-11-01',
    paymentKind: 'estimated_min',
    acceptsNewCharges: false,
    creditLimit: 5000,
    carryingBalance: true,
    annualFee: 0,
    balanceAsOf: reviewToday,
    promos: []
  }
];

const reviewPayday = {
  id: 10,
  name: 'Paycheck',
  amount: 800,
  direction: 'gain',
  startDate: reviewToday,
  cadence: 'one_time',
  paymentMethod: 'cash',
  canPutOnCard: false,
  paymentDebtId: null,
  locked: false
};

const extrasOn = (plan, date, debtId) => {
  const day = plan.days.find((entry) => entry.date === date);
  if (!day) return [];
  return day.items.filter((item) => item.kind === 'extra_payment' && item.debtId === debtId);
};

const plannedReview = engine.project({
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: reviewToday,
  windowTo: reviewToday,
  debts: reviewDebts,
  events: [reviewPayday]
});
const plannedHigh = extrasOn(plannedReview, reviewToday, 1);
check(
  'planned extra goes to the highest-rate debt',
  plannedHigh.length > 0 && plannedHigh[0].amount > 0,
  plannedHigh[0] ? `$${plannedHigh[0].amount} to ${plannedHigh[0].name}` : 'none'
);

const holdHigh = engine.project({
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: reviewToday,
  windowTo: reviewToday,
  debts: reviewDebts.map((debt) =>
    debt.id === 1 ? { ...debt, noExtraPayoff: true } : debt
  ),
  events: [reviewPayday]
});
const holdHighExtra = extrasOn(holdHigh, reviewToday, 1);
const holdLowExtra = extrasOn(holdHigh, reviewToday, 2);
check(
  'no-extra-payoff keeps extras off that debt',
  holdHighExtra.length === 0 && holdLowExtra.length > 0,
  holdHighExtra.length > 0
    ? `still hit ${holdHighExtra[0].name}`
    : holdLowExtra[0]
      ? `extra → ${holdLowExtra[0].name}`
      : 'no extra at all'
);

const skippedExtra = engine.project({
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: reviewToday,
  windowTo: reviewToday,
  debts: reviewDebts,
  events: [reviewPayday],
  actuals: [{ date: reviewToday, itemKey: 'extra_payment:debt:1', status: 'skipped' }]
});
const skipDay = skippedExtra.days.find((entry) => entry.date === reviewToday);
const skipHigh = extrasOn(skippedExtra, reviewToday, 1);
const skipLow = extrasOn(skippedExtra, reviewToday, 2);
check(
  'skipping that extra does not send the leftover to the next debt',
  (skipHigh.length === 0 || skipHigh[0].amount === 0)
    && (skipLow.length === 0 || skipLow[0].amount === 0),
  `high ${skipHigh[0] ? skipHigh[0].amount : 'none'}, low ${skipLow[0] ? skipLow[0].amount : 'none'}`
);
check(
  'and the cash stays available for later days',
  skipDay ? skipDay.endCash === 800 : false,
  skipDay ? `end cash ${skipDay.endCash}` : 'today missing'
);

const modifiedExtra = engine.project({
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: reviewToday,
  windowTo: reviewToday,
  debts: reviewDebts,
  events: [reviewPayday],
  actuals: [{
    date: reviewToday,
    itemKey: 'extra_payment:debt:1',
    status: 'modified',
    amount: 150
  }]
});
const modDay = modifiedExtra.days.find((entry) => entry.date === reviewToday);
const modHigh = extrasOn(modifiedExtra, reviewToday, 1);
const modLow = extrasOn(modifiedExtra, reviewToday, 2);
check(
  'a modified extra uses the amount you entered',
  !!modHigh[0] && modHigh[0].amount === 150 && modHigh[0].review === 'modified',
  modHigh[0] ? `$${modHigh[0].amount} (${modHigh[0].review})` : 'none'
);
check(
  'and does not dump the leftover onto the next debt',
  modLow.length === 0 || modLow[0].amount === 0,
  modLow[0] ? `low got ${modLow[0].amount}` : 'low untouched'
);
check(
  'so the next plan starts from the leftover cash',
  modDay ? modDay.endCash === 650 : false,
  modDay ? `end cash ${modDay.endCash}` : 'today missing'
);

const yesterday = '2026-10-13';
const historyPayday = { ...reviewPayday, id: 11, startDate: yesterday, dueDate: yesterday };
const historyBase = {
  today: reviewToday,
  cashFloor: 0,
  strategy: 'optimized',
  horizonMonths: 2,
  windowFrom: yesterday,
  windowTo: reviewToday,
  debts: reviewDebts,
  events: [historyPayday]
};

const unconfirmedHistory = engine.project(historyBase);
check(
  'an unconfirmed extra yesterday does not spend leftover cash',
  unconfirmedHistory.summary.cashOnHand === 800,
  `cash on hand ${unconfirmedHistory.summary.cashOnHand}`
);

const confirmedHistory = engine.project({
  ...historyBase,
  actuals: [{
    date: yesterday,
    itemKey: 'extra_payment:debt:1',
    status: 'confirmed',
    amount: 300
  }]
});
const confirmedToday = confirmedHistory.days.find((entry) => entry.date === reviewToday);
check(
  'confirming that extra spends the cash, and today starts from what is left',
  confirmedHistory.summary.cashOnHand === 500
    && confirmedToday
    && confirmedToday.startCash === 500,
  `cash on hand ${confirmedHistory.summary.cashOnHand}, today start ${confirmedToday ? confirmedToday.startCash : 'missing'}`
);

console.log(
  failures === 0
    ? '\n✅ All engine checks passed.\n'
    : `\n❌ ${failures} check(s) failed.\n`
);
process.exit(failures === 0 ? 0 : 1);
