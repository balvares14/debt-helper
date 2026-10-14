/**
 * Demo plan.
 *
 * Deliberately built as a test of the routing rules, not a flattering example:
 *   - Card B is expensive and already carrying, so groceries must NOT land there
 *   - Card C has a real 0% purchase window, so groceries should
 *   - rent is due before the next paycheck, so the optimizer must not drain
 *     cash into Card B and leave it short
 *   - the floor ($1,000) starts above the cash on hand ($800), which should
 *     show a floor warning rather than block anything
 */

const dates = require('./dates');

function buildDemoPlan(today) {
  const iso = dates.isValidISODate(today) ? today : dates.todayISO();

  return {
    settings: { cashFloor: 1000, strategy: 'optimized', horizonMonths: 60 },

    initialCash: { amount: 800, date: iso, name: 'Starting cash' },

    debts: [
      {
        name: 'Card B',
        debtType: 'credit_card',
        balance: 6400,
        apr: 29.99,
        dueDay: 12,
        paymentKind: 'estimated_min',
        acceptsNewCharges: true,
        creditLimit: 8000,
        carryingBalance: true,
        annualFee: 0,
        notes: 'Highest rate. Attack this one; do not spend on it.',
        promos: []
      },
      {
        name: 'Card C',
        debtType: 'credit_card',
        balance: 1200,
        apr: 18.99,
        dueDay: 20,
        paymentKind: 'estimated_min',
        acceptsNewCharges: true,
        creditLimit: 4000,
        carryingBalance: true,
        annualFee: 0,
        notes: 'Existing balance at 0% for 4 more months; new purchases 0% for 6.',
        promos: [
          {
            kind: 'existing_balance',
            apr: 0,
            appliesToAmount: 1200,
            endDate: dates.addMonths(iso, 4)
          },
          {
            kind: 'purchase',
            apr: 0,
            appliesToAmount: null,
            endDate: dates.addMonths(iso, 6)
          }
        ]
      },
      {
        name: 'Auto loan',
        debtType: 'loan',
        balance: 11200,
        apr: 7.4,
        dueDay: 3,
        paymentKind: 'fixed',
        fixedPayment: 310,
        acceptsNewCharges: false,
        creditLimit: null,
        carryingBalance: true,
        annualFee: 0,
        notes: 'Installment loan. Cannot take charges.',
        promos: []
      }
    ],

    events: [
      {
        name: 'Paycheck',
        amount: 1900,
        direction: 'gain',
        startDate: iso,
        cadence: 'biweekly',
        canPutOnCard: false,
        paymentMethod: 'cash'
      },
      {
        name: 'Rent',
        amount: 1650,
        direction: 'charge',
        // Due on the 1st of next month, which lands before the second paycheck.
        startDate: dates.buildISO(
          dates.partsOf(dates.addMonths(iso, 1)).year,
          dates.partsOf(dates.addMonths(iso, 1)).month,
          1
        ),
        cadence: 'monthly',
        canPutOnCard: false,
        paymentMethod: 'cash'
      },
      {
        name: 'Groceries',
        amount: 160,
        direction: 'charge',
        startDate: dates.addDays(iso, 2),
        cadence: 'weekly',
        canPutOnCard: true,
        paymentMethod: 'optimizer'
      }
    ]
  };
}

module.exports = { buildDemoPlan };
