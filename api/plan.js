/**
 * The plan: settings and the projection itself.
 *
 * Everything here is scoped to req.user.userId, so a debt row is only ever
 * visible to the person who entered it.
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { fail, handle, respondWithPlan } = require('../utils/planRoutes');
const { repository, validation, dates } = require('../services/planner');
const { buildDemoPlan } = require('../services/planner/demoData');

router.use(authenticateToken);

/**
 * The whole plan, recalculated.
 * GET /api/plan?today=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * `today` is the caller's local date, so the calendar lines up with the day
 * they are actually living in. `from`/`to` bound the day-by-day detail; the
 * summary and payoff date always cover the full horizon regardless of window.
 */
router.get(
  '/',
  handle('load the plan', async (req, res) => {
    await respondWithPlan(req, res, 'Plan calculated');
  })
);

/**
 * PUT /api/plan/settings   { cashFloor?, strategy?, horizonMonths? }
 */
router.put(
  '/settings',
  handle('update settings', async (req, res) => {
    const parsed = validation.validateSettings(req.body);
    if (!parsed.ok) return fail(res, 400, 'Check these settings.', parsed.errors);

    await repository.updateSettings(req.user.userId, parsed.value);
    await respondWithPlan(req, res, 'Settings updated');
  })
);

/**
 * The opening cash balance, stored as a one-time gain so the ledger has a
 * single kind of input. Upserted — "how much cash do I have" has one answer.
 *
 * PUT /api/plan/cash   { amount, date, name? }
 */
router.put(
  '/cash',
  handle('save your starting cash', async (req, res) => {
    const parsed = validation.validateInitialDeposit(req.body);
    if (!parsed.ok) return fail(res, 400, 'Check the starting cash.', parsed.errors);

    await repository.setInitialDeposit(req.user.userId, parsed.value);
    await respondWithPlan(req, res, 'Starting cash saved');
  })
);

/**
 * Confirm, skip, or change what happened on a day on or before today.
 * PUT /api/plan/actuals  { date, itemKey, status, amount?, plannedAmount?, debtId?, method? }
 */
router.put(
  '/actuals',
  handle('save that review', async (req, res) => {
    const parsed = validation.validateActual(req.body);
    if (!parsed.ok) return fail(res, 400, 'Check this review.', parsed.errors);

    const today = dates.isValidISODate(req.query.today)
      ? req.query.today
      : dates.isValidISODate(req.body.today)
        ? req.body.today
        : dates.todayISO();
    if (parsed.value.date > today) {
      return fail(res, 400, 'Future days cannot be marked as already done.');
    }

    await repository.upsertActual(req.user.userId, parsed.value);
    const verb = parsed.value.status === 'skipped'
      ? 'skipped'
      : parsed.value.status === 'modified'
        ? 'updated'
        : 'confirmed';
    await respondWithPlan(req, res, `Day updated — ${verb}`);
  })
);

/**
 * Clear a review so the plan treats that item as unconfirmed again.
 * DELETE /api/plan/actuals?date=&itemKey=
 */
router.delete(
  '/actuals',
  handle('clear that review', async (req, res) => {
    const date = dates.isValidISODate(req.query.date) ? req.query.date : null;
    const itemKey = typeof req.query.itemKey === 'string' ? req.query.itemKey.trim() : '';
    if (!date || !itemKey) return fail(res, 400, 'Needs the date and item to clear.');

    await repository.deleteActual(req.user.userId, date, itemKey);
    await respondWithPlan(req, res, 'Review cleared');
  })
);

/**
 * Replaces everything with the sample plan, for trying the app out.
 * POST /api/plan/demo
 */
router.post(
  '/demo',
  handle('load the demo plan', async (req, res) => {
    const today = dates.isValidISODate(req.body.today) ? req.body.today : dates.todayISO();
    await repository.replacePlan(req.user.userId, buildDemoPlan(today));
    await respondWithPlan(req, res, 'Demo plan loaded');
  })
);

/**
 * Clears every debt, gain and charge and restores default settings.
 * DELETE /api/plan
 */
router.delete(
  '/',
  handle('clear your plan', async (req, res) => {
    await repository.clearPlan(req.user.userId);
    await respondWithPlan(req, res, 'Plan cleared');
  })
);

module.exports = router;
