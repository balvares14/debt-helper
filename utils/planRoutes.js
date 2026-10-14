/**
 * Shared response helpers for the planner routes.
 *
 * Every write answers with the recalculated plan rather than the row that
 * changed, so the client never has to guess what a change did to the payoff
 * order, the routing or the calendar.
 */

const logger = require('./logger');
const { buildPlan } = require('../services/planner');

function fail(res, status, message, errors) {
  return res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {})
  });
}

/** Wraps a handler so an unexpected throw becomes one logged 500. */
function handle(name, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.logError(error, {
        operation: name,
        userId: req.user ? req.user.userId : null
      });
      fail(res, 500, `Could not ${name}.`);
    }
  };
}

/** Rebuilds and returns the whole plan. The calendar window and the caller's
 *  local date can ride along on either the query string or the body. */
async function respondWithPlan(req, res, message) {
  const body = req.body || {};
  const plan = await buildPlan(req.user.userId, {
    today: req.query.today || body.today,
    from: req.query.from || body.from,
    to: req.query.to || body.to
  });
  return res.json({ success: true, message, data: plan });
}

/** Path params arrive as strings; anything non-numeric is a 404, not a crash. */
function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { fail, handle, respondWithPlan, parseId };
