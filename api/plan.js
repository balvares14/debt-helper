/**
 * The plan: settings, starting cash, and the projection itself.
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
