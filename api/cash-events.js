/**
 * Gains and charges — the money moving in and out that the calendar is built from.
 *
 * The starting cash balance is not here: it lives at PUT /api/plan/cash
 * because it is upserted rather than listed.
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { fail, handle, respondWithPlan, parseId } = require('../utils/planRoutes');
const { repository, validation } = require('../services/planner');

router.use(authenticateToken);

/** GET /api/cash-events */
router.get(
  '/',
  handle('load your gains and charges', async (req, res) => {
    const events = await repository.listEvents(req.user.userId);
    res.json({ success: true, data: { events } });
  })
);

/**
 * POST /api/cash-events
 * { name, amount, direction, startDate, cadence, endDate?, canPutOnCard?,
 *   paymentMethod?, paymentDebtId?, locked? }
 */
router.post(
  '/',
  handle('add that entry', async (req, res) => {
    // Pinning a charge to a card is only legal if that card is real, is the
    // user's, and actually takes charges — so validation needs the debt list.
    const debts = await repository.listDebts(req.user.userId);
    const parsed = validation.validateEvent(req.body, debts);
    if (!parsed.ok) return fail(res, 400, 'Check these fields.', parsed.errors);

    const event = await repository.createEvent(req.user.userId, parsed.value);
    await respondWithPlan(req, res, `${event.name} added`);
  })
);

/** PUT /api/cash-events/:id */
router.put(
  '/:id',
  handle('update that entry', async (req, res) => {
    const eventId = parseId(req.params.id);
    if (!eventId) return fail(res, 404, 'Entry not found.');

    const existing = await repository.getEvent(req.user.userId, eventId);
    if (!existing) return fail(res, 404, 'Entry not found.');

    if (existing.isInitialDeposit) {
      return fail(res, 400, 'Edit your starting cash from the cash field instead.');
    }

    const debts = await repository.listDebts(req.user.userId);
    const parsed = validation.validateEvent(req.body, debts);
    if (!parsed.ok) return fail(res, 400, 'Check these fields.', parsed.errors);

    const event = await repository.updateEvent(req.user.userId, eventId, parsed.value);
    if (!event) return fail(res, 404, 'Entry not found.');

    await respondWithPlan(req, res, `${event.name} updated`);
  })
);

/**
 * PATCH /api/cash-events/:id/status
 * { status: 'active' | 'draft' }
 *
 * Draft means the entry stays saved but is ignored by the projection.
 * Starting cash cannot be drafted — it always counts.
 */
router.patch(
  '/:id/status',
  handle('update that entry', async (req, res) => {
    const eventId = parseId(req.params.id);
    if (!eventId) return fail(res, 404, 'Entry not found.');

    const existing = await repository.getEvent(req.user.userId, eventId);
    if (!existing) return fail(res, 404, 'Entry not found.');

    if (existing.isInitialDeposit) {
      return fail(res, 400, 'Starting cash always counts in the plan.');
    }

    const status = validation.asStatus(req.body.status, null);
    if (!status) {
      return fail(res, 400, 'Status must be active or draft.', [
        { field: 'status', message: 'Status must be active or draft.' }
      ]);
    }

    const event = await repository.setEventStatus(req.user.userId, eventId, status);
    if (!event) return fail(res, 404, 'Entry not found.');

    await respondWithPlan(req, res, `${event.name} set to ${status}`);
  })
);

/** DELETE /api/cash-events/:id */
router.delete(
  '/:id',
  handle('delete that entry', async (req, res) => {
    const eventId = parseId(req.params.id);
    if (!eventId) return fail(res, 404, 'Entry not found.');

    const existing = await repository.getEvent(req.user.userId, eventId);
    if (!existing) return fail(res, 404, 'Entry not found.');

    await repository.deleteEvent(req.user.userId, eventId);
    await respondWithPlan(req, res, `${existing.name} deleted`);
  })
);

module.exports = router;
