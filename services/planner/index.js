/**
 * Planner facade.
 *
 * Every mutation in the API answers with a freshly built plan, because a debt
 * plan has no meaningful partial state: change one APR and the payoff order,
 * the routing and the calendar can all move. One call in, whole plan out.
 */

const engine = require('./engine');
const repository = require('./repository');
const validation = require('./validation');
const dates = require('./dates');

/**
 * Loads the user's inputs and runs the projection.
 *
 * @param {number|string} userId
 * @param {object} [options]
 * @param {string} [options.today]  the user's own local date, so "today" is
 *                                  their calendar day rather than the server's
 * @param {string} [options.from]   first day of full daily detail
 * @param {string} [options.to]     last day of full daily detail
 */
async function buildPlan(userId, options = {}) {
  const { settings, debts, events } = await repository.loadPlan(userId);

  const today = dates.isValidISODate(options.today) ? options.today : dates.todayISO();
  const from = dates.isValidISODate(options.from) ? options.from : null;
  const to = dates.isValidISODate(options.to) ? options.to : null;

  // Draft rows stay in the saved plan so they can be turned back on, but the
  // engine never sees them. Charges pinned to a draft card fall back to cash
  // for the projection only; the pin itself is left alone.
  const liveDebts = debts.filter((debt) => debt.status !== 'draft');
  const liveDebtIds = new Set(liveDebts.map((debt) => debt.id));
  const liveEvents = events
    .filter((event) => event.isInitialDeposit || event.status !== 'draft')
    .map((event) => {
      if (event.paymentDebtId && !liveDebtIds.has(event.paymentDebtId)) {
        return { ...event, paymentMethod: 'cash', paymentDebtId: null, locked: false };
      }
      return event;
    });

  const projection = engine.project({
    today,
    cashFloor: settings.cashFloor,
    strategy: settings.strategy,
    horizonMonths: settings.horizonMonths,
    debts: liveDebts,
    events: liveEvents,
    windowFrom: from,
    // An inverted range would collect nothing; fall back to the default window.
    windowTo: to && from && to < from ? null : to
  });

  const initialDeposit = events.find((event) => event.isInitialDeposit) || null;

  return {
    settings: {
      cashFloor: Number(settings.cashFloor),
      strategy: settings.strategy,
      horizonMonths: settings.horizonMonths
    },
    initialDeposit,
    debts,
    events: events.filter((event) => !event.isInitialDeposit),
    projection
  };
}

module.exports = { buildPlan, engine, repository, validation, dates };
