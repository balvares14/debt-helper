/**
 * Debts and their promotional rates.
 *
 * Promos are written as a set rather than individually: a debt has at most
 * two, and replacing them wholesale avoids an edit leaving a card with a
 * stale 0% window the engine would keep honouring.
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { fail, handle, respondWithPlan, parseId } = require('../utils/planRoutes');
const { repository, validation } = require('../services/planner');

router.use(authenticateToken);

/** GET /api/debts */
router.get(
  '/',
  handle('load your debts', async (req, res) => {
    const debts = await repository.listDebts(req.user.userId);
    res.json({ success: true, data: { debts } });
  })
);

/**
 * POST /api/debts
 * Body mirrors the debt fields, plus an optional `promos: [{ kind, apr, appliesToAmount, endDate }]`.
 */
router.post(
  '/',
  handle('add that debt', async (req, res) => {
    const parsed = validation.validateDebt(req.body);
    if (!parsed.ok) return fail(res, 400, 'Check these fields.', parsed.errors);

    const debt = await repository.createDebt(req.user.userId, parsed.value);
    if (parsed.promos.length > 0) {
      await repository.replacePromos(req.user.userId, debt.id, parsed.promos);
    }

    await respondWithPlan(req, res, `${debt.name} added`);
  })
);

/** PUT /api/debts/:id */
router.put(
  '/:id',
  handle('update that debt', async (req, res) => {
    const debtId = parseId(req.params.id);
    if (!debtId) return fail(res, 404, 'Debt not found.');

    const parsed = validation.validateDebt(req.body);
    if (!parsed.ok) return fail(res, 400, 'Check these fields.', parsed.errors);

    const debt = await repository.updateDebt(req.user.userId, debtId, parsed.value);
    if (!debt) return fail(res, 404, 'Debt not found.');

    // `promos` omitted leaves existing promos alone; an empty array clears them.
    if (Array.isArray(req.body.promos)) {
      await repository.replacePromos(req.user.userId, debtId, parsed.promos);
    }

    await respondWithPlan(req, res, `${debt.name} updated`);
  })
);

/**
 * PATCH /api/debts/:id/status
 * { status: 'active' | 'draft' }
 *
 * Draft means the debt stays saved but is ignored by the projection.
 */
router.patch(
  '/:id/status',
  handle('update that debt', async (req, res) => {
    const debtId = parseId(req.params.id);
    if (!debtId) return fail(res, 404, 'Debt not found.');

    const status = validation.asStatus(req.body.status, null);
    if (!status) {
      return fail(res, 400, 'Status must be active or draft.', [
        { field: 'status', message: 'Status must be active or draft.' }
      ]);
    }

    const debt = await repository.setDebtStatus(req.user.userId, debtId, status);
    if (!debt) return fail(res, 404, 'Debt not found.');

    await respondWithPlan(req, res, `${debt.name} set to ${status}`);
  })
);

/**
 * DELETE /api/debts/:id
 *
 * Charges pinned to this card fall back to cash (ON DELETE SET NULL on
 * payment_debt_id), so no charge is silently lost with the card.
 */
router.delete(
  '/:id',
  handle('delete that debt', async (req, res) => {
    const debtId = parseId(req.params.id);
    if (!debtId) return fail(res, 404, 'Debt not found.');

    const existing = await repository.getDebt(req.user.userId, debtId);
    if (!existing) return fail(res, 404, 'Debt not found.');

    await repository.deleteDebt(req.user.userId, debtId);
    await respondWithPlan(req, res, `${existing.name} deleted`);
  })
);

module.exports = router;
