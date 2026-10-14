/**
 * Loads a user's plan out of Postgres and hands the engine plain, typed data.
 *
 * Two things this layer is responsible for, because nothing downstream should
 * have to think about them again:
 *   - snake_case columns become camelCase fields
 *   - NUMERIC columns arrive as strings, since node-postgres protects
 *     precision by default. These are all NUMERIC(14,2) or NUMERIC(6,3), so
 *     they fit a JS number exactly and the client can treat them as numbers.
 */

const pool = require('../../db');

/** NUMERIC string -> number, preserving null. */
function numeric(value) {
  return value === null || value === undefined ? null : Number(value);
}

const DEBT_COLUMNS = `
  id, user_id, name, debt_type, balance, apr, due_day, payment_kind,
  fixed_payment, override_min, accepts_new_charges, credit_limit,
  annual_fee, annual_fee_month, carrying_balance, notes, status,
  created_at, updated_at
`;

const EVENT_COLUMNS = `
  id, user_id, name, amount, direction, start_date, cadence, end_date,
  can_put_on_card, payment_method, payment_debt_id, locked,
  is_initial_deposit, status, created_at, updated_at
`;

function asItemStatus(value) {
  return value === 'draft' ? 'draft' : 'active';
}

const DEFAULT_SETTINGS = { cashFloor: '100.00', strategy: 'optimized', horizonMonths: 60 };

function mapDebt(row) {
  return {
    id: Number(row.id),
    name: row.name,
    debtType: row.debt_type,
    balance: numeric(row.balance),
    apr: numeric(row.apr),
    dueDay: Number(row.due_day),
    paymentKind: row.payment_kind,
    fixedPayment: numeric(row.fixed_payment),
    overrideMin: numeric(row.override_min),
    acceptsNewCharges: row.accepts_new_charges,
    creditLimit: numeric(row.credit_limit),
    annualFee: numeric(row.annual_fee),
    annualFeeMonth: row.annual_fee_month === null ? null : Number(row.annual_fee_month),
    carryingBalance: row.carrying_balance,
    notes: row.notes,
    status: asItemStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    promos: []
  };
}

function mapPromo(row) {
  return {
    id: Number(row.id),
    debtId: Number(row.debt_id),
    kind: row.kind,
    apr: numeric(row.apr),
    appliesToAmount: numeric(row.applies_to_amount),
    endDate: row.end_date
  };
}

function mapEvent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    amount: numeric(row.amount),
    direction: row.direction,
    startDate: row.start_date,
    cadence: row.cadence,
    endDate: row.end_date,
    canPutOnCard: row.can_put_on_card,
    paymentMethod: row.payment_method,
    paymentDebtId: row.payment_debt_id === null ? null : Number(row.payment_debt_id),
    locked: row.locked,
    isInitialDeposit: row.is_initial_deposit,
    status: asItemStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS, cashFloor: Number(DEFAULT_SETTINGS.cashFloor) };
  return {
    cashFloor: numeric(row.cash_floor),
    strategy: row.strategy,
    horizonMonths: Number(row.horizon_months)
  };
}

/**
 * Reads settings, creating the default row the first time a user shows up.
 *
 * Deliberately a read that usually stays a read: an upsert here would touch
 * the row (and bump updated_at) on every single plan load.
 */
async function getSettings(userId) {
  const existing = await pool.query(
    'SELECT cash_floor, strategy, horizon_months FROM plan_settings WHERE user_id = $1',
    [userId]
  );
  if (existing.rowCount > 0) return mapSettings(existing.rows[0]);

  const created = await pool.query(
    `INSERT INTO plan_settings (user_id)
          VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
       RETURNING cash_floor, strategy, horizon_months`,
    [userId]
  );

  // DO NOTHING returns no row if a concurrent request won the race.
  if (created.rowCount > 0) return mapSettings(created.rows[0]);

  const reread = await pool.query(
    'SELECT cash_floor, strategy, horizon_months FROM plan_settings WHERE user_id = $1',
    [userId]
  );
  return mapSettings(reread.rows[0]);
}

async function updateSettings(userId, patch) {
  const { rows } = await pool.query(
    `INSERT INTO plan_settings (user_id, cash_floor, strategy, horizon_months)
          VALUES ($1, COALESCE($2, 100), COALESCE($3, 'optimized'), COALESCE($4, 60))
     ON CONFLICT (user_id) DO UPDATE
            SET cash_floor     = COALESCE($2, plan_settings.cash_floor),
                strategy       = COALESCE($3, plan_settings.strategy),
                horizon_months = COALESCE($4, plan_settings.horizon_months)
       RETURNING cash_floor, strategy, horizon_months`,
    [
      userId,
      patch.cashFloor ?? null,
      patch.strategy ?? null,
      patch.horizonMonths ?? null
    ]
  );
  return mapSettings(rows[0]);
}

/** Every debt for a user, each with its promos attached. */
async function listDebts(userId) {
  const debtResult = await pool.query(
    `SELECT ${DEBT_COLUMNS} FROM debts WHERE user_id = $1 ORDER BY id`,
    [userId]
  );

  const debts = debtResult.rows.map(mapDebt);
  if (debts.length === 0) return debts;

  const promoResult = await pool.query(
    `SELECT p.id, p.debt_id, p.kind, p.apr, p.applies_to_amount, p.end_date
       FROM debt_promos p
       JOIN debts d ON d.id = p.debt_id
      WHERE d.user_id = $1
      ORDER BY p.id`,
    [userId]
  );

  const byDebtId = new Map(debts.map((debt) => [debt.id, debt]));
  for (const row of promoResult.rows) {
    const promo = mapPromo(row);
    const debt = byDebtId.get(promo.debtId);
    if (debt) debt.promos.push(promo);
  }

  return debts;
}

async function getDebt(userId, debtId) {
  const { rows } = await pool.query(
    `SELECT ${DEBT_COLUMNS} FROM debts WHERE id = $1 AND user_id = $2`,
    [debtId, userId]
  );
  if (rows.length === 0) return null;

  const debt = mapDebt(rows[0]);
  const promoResult = await pool.query(
    `SELECT id, debt_id, kind, apr, applies_to_amount, end_date
       FROM debt_promos WHERE debt_id = $1 ORDER BY id`,
    [debt.id]
  );
  debt.promos = promoResult.rows.map(mapPromo);
  return debt;
}

async function createDebt(userId, input) {
  const { rows } = await pool.query(
    `INSERT INTO debts (
       user_id, name, debt_type, balance, apr, due_day, payment_kind,
       fixed_payment, override_min, accepts_new_charges, credit_limit,
       annual_fee, annual_fee_month, carrying_balance, notes, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING ${DEBT_COLUMNS}`,
    [
      userId,
      input.name,
      input.debtType,
      input.balance,
      input.apr,
      input.dueDay,
      input.paymentKind,
      input.fixedPayment,
      input.overrideMin,
      input.acceptsNewCharges,
      input.creditLimit,
      input.annualFee,
      input.annualFeeMonth,
      input.carryingBalance,
      input.notes,
      asItemStatus(input.status)
    ]
  );
  return mapDebt(rows[0]);
}

async function updateDebt(userId, debtId, input) {
  const { rows } = await pool.query(
    `UPDATE debts SET
       name = $3, debt_type = $4, balance = $5, apr = $6, due_day = $7,
       payment_kind = $8, fixed_payment = $9, override_min = $10,
       accepts_new_charges = $11, credit_limit = $12, annual_fee = $13,
       annual_fee_month = $14, carrying_balance = $15, notes = $16,
       status = $17
     WHERE id = $1 AND user_id = $2
     RETURNING ${DEBT_COLUMNS}`,
    [
      debtId,
      userId,
      input.name,
      input.debtType,
      input.balance,
      input.apr,
      input.dueDay,
      input.paymentKind,
      input.fixedPayment,
      input.overrideMin,
      input.acceptsNewCharges,
      input.creditLimit,
      input.annualFee,
      input.annualFeeMonth,
      input.carryingBalance,
      input.notes,
      asItemStatus(input.status)
    ]
  );

  if (rows.length === 0) return null;

  // Turning off new charges has to release whatever was pinned here, or the
  // engine would keep routing spend onto a card the user just closed.
  if (!input.acceptsNewCharges) {
    await pool.query(
      `UPDATE cash_events
          SET payment_method = 'cash', payment_debt_id = NULL, locked = FALSE
        WHERE user_id = $1 AND payment_debt_id = $2`,
      [userId, debtId]
    );
  }

  return mapDebt(rows[0]);
}

/**
 * Deletes a debt and releases anything pinned to it.
 *
 * The foreign key is ON DELETE SET NULL, but a cash_event with
 * payment_method = 'card' and a null target violates its own CHECK
 * constraint, so the delete would fail. Send those charges back to cash
 * first: losing the card should not lose the grocery bill.
 */
async function deleteDebt(userId, debtId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE cash_events
          SET payment_method = 'cash', payment_debt_id = NULL, locked = FALSE
        WHERE user_id = $1 AND payment_debt_id = $2`,
      [userId, debtId]
    );

    const { rowCount } = await client.query(
      'DELETE FROM debts WHERE id = $1 AND user_id = $2',
      [debtId, userId]
    );

    await client.query('COMMIT');
    return rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Replaces a debt's promos wholesale — simpler than diffing, and a debt has
 *  at most two. */
async function replacePromos(userId, debtId, promos) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const owned = await client.query('SELECT id FROM debts WHERE id = $1 AND user_id = $2', [
      debtId,
      userId
    ]);
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM debt_promos WHERE debt_id = $1', [debtId]);

    const created = [];
    for (const promo of promos) {
      const { rows } = await client.query(
        `INSERT INTO debt_promos (debt_id, kind, apr, applies_to_amount, end_date)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING id, debt_id, kind, apr, applies_to_amount, end_date`,
        [debtId, promo.kind, promo.apr, promo.appliesToAmount, promo.endDate]
      );
      created.push(mapPromo(rows[0]));
    }

    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listEvents(userId) {
  const { rows } = await pool.query(
    `SELECT ${EVENT_COLUMNS}
       FROM cash_events
      WHERE user_id = $1
      ORDER BY is_initial_deposit DESC, direction, start_date, id`,
    [userId]
  );
  return rows.map(mapEvent);
}

async function createEvent(userId, input) {
  const { rows } = await pool.query(
    `INSERT INTO cash_events (
       user_id, name, amount, direction, start_date, cadence, end_date,
       can_put_on_card, payment_method, payment_debt_id, locked,
       is_initial_deposit, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING ${EVENT_COLUMNS}`,
    [
      userId,
      input.name,
      input.amount,
      input.direction,
      input.startDate,
      input.cadence,
      input.endDate,
      input.canPutOnCard,
      input.paymentMethod,
      input.paymentDebtId,
      input.locked,
      input.isInitialDeposit,
      input.isInitialDeposit ? 'active' : asItemStatus(input.status)
    ]
  );
  return mapEvent(rows[0]);
}

async function updateEvent(userId, eventId, input) {
  const { rows } = await pool.query(
    `UPDATE cash_events SET
       name = $3, amount = $4, direction = $5, start_date = $6, cadence = $7,
       end_date = $8, can_put_on_card = $9, payment_method = $10,
       payment_debt_id = $11, locked = $12, status = $13
     WHERE id = $1 AND user_id = $2
     RETURNING ${EVENT_COLUMNS}`,
    [
      eventId,
      userId,
      input.name,
      input.amount,
      input.direction,
      input.startDate,
      input.cadence,
      input.endDate,
      input.canPutOnCard,
      input.paymentMethod,
      input.paymentDebtId,
      input.locked,
      asItemStatus(input.status)
    ]
  );
  return rows.length > 0 ? mapEvent(rows[0]) : null;
}

async function getEvent(userId, eventId) {
  const { rows } = await pool.query(
    `SELECT ${EVENT_COLUMNS} FROM cash_events WHERE id = $1 AND user_id = $2`,
    [eventId, userId]
  );
  return rows.length > 0 ? mapEvent(rows[0]) : null;
}

async function deleteEvent(userId, eventId) {
  const { rowCount } = await pool.query(
    'DELETE FROM cash_events WHERE id = $1 AND user_id = $2',
    [eventId, userId]
  );
  return rowCount > 0;
}

async function setDebtStatus(userId, debtId, status) {
  const { rows } = await pool.query(
    `UPDATE debts SET status = $3 WHERE id = $1 AND user_id = $2
      RETURNING ${DEBT_COLUMNS}`,
    [debtId, userId, asItemStatus(status)]
  );
  return rows.length > 0 ? mapDebt(rows[0]) : null;
}

async function setEventStatus(userId, eventId, status) {
  const { rows } = await pool.query(
    `UPDATE cash_events SET status = $3
      WHERE id = $1 AND user_id = $2 AND NOT is_initial_deposit
      RETURNING ${EVENT_COLUMNS}`,
    [eventId, userId, asItemStatus(status)]
  );
  return rows.length > 0 ? mapEvent(rows[0]) : null;
}

/**
 * The opening cash balance. Stored as a one-time gain flagged
 * is_initial_deposit so the ledger has exactly one kind of input, and upserted
 * because "how much do I have" only ever has one answer.
 */
async function setInitialDeposit(userId, { amount, date, name }) {
  const existing = await pool.query(
    'SELECT id FROM cash_events WHERE user_id = $1 AND is_initial_deposit',
    [userId]
  );

  if (existing.rowCount > 0) {
    const { rows } = await pool.query(
      `UPDATE cash_events
          SET name = $3, amount = $4, start_date = $5, status = 'active'
        WHERE id = $1 AND user_id = $2
        RETURNING ${EVENT_COLUMNS}`,
      [existing.rows[0].id, userId, name, amount, date]
    );
    return mapEvent(rows[0]);
  }

  return createEvent(userId, {
    name,
    amount,
    direction: 'gain',
    startDate: date,
    cadence: 'one_time',
    endDate: null,
    canPutOnCard: false,
    paymentMethod: 'cash',
    paymentDebtId: null,
    locked: false,
    isInitialDeposit: true,
    status: 'active'
  });
}

/** Wipes a user's plan. Settings are reset rather than deleted so the row
 *  keeps its defaults. */
async function clearPlan(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Charges first: they reference debts.
    await client.query('DELETE FROM cash_events WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM debts WHERE user_id = $1', [userId]);
    await client.query(
      `UPDATE plan_settings
          SET cash_floor = $2, strategy = $3, horizon_months = $4
        WHERE user_id = $1`,
      [userId, DEFAULT_SETTINGS.cashFloor, DEFAULT_SETTINGS.strategy, DEFAULT_SETTINGS.horizonMonths]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Replaces a user's plan with a ready-made one.
 *
 * Debts go in first so a charge can be pinned to a card by name, which is how
 * the demo expresses "put this on Card C" without knowing generated ids.
 */
async function replacePlan(userId, plan) {
  await clearPlan(userId);
  await updateSettings(userId, plan.settings);

  const debtIdsByName = new Map();
  for (const debt of plan.debts) {
    const created = await createDebt(userId, {
      fixedPayment: null,
      overrideMin: null,
      annualFee: 0,
      annualFeeMonth: null,
      notes: null,
      ...debt
    });
    debtIdsByName.set(debt.name, created.id);

    if (debt.promos && debt.promos.length > 0) {
      await replacePromos(userId, created.id, debt.promos);
    }
  }

  if (plan.initialCash) {
    await setInitialDeposit(userId, plan.initialCash);
  }

  for (const event of plan.events) {
    const { pinnedDebtName, ...fields } = event;
    await createEvent(userId, {
      endDate: null,
      canPutOnCard: false,
      paymentMethod: 'cash',
      locked: false,
      isInitialDeposit: false,
      ...fields,
      paymentDebtId: pinnedDebtName ? debtIdsByName.get(pinnedDebtName) ?? null : null
    });
  }
}

/** Everything the engine needs, in one round of queries. */
async function loadPlan(userId) {
  const [settings, debts, events] = await Promise.all([
    getSettings(userId),
    listDebts(userId),
    listEvents(userId)
  ]);
  return { settings, debts, events };
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  listDebts,
  getDebt,
  createDebt,
  updateDebt,
  deleteDebt,
  setDebtStatus,
  replacePromos,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  setEventStatus,
  setInitialDeposit,
  clearPlan,
  replacePlan,
  loadPlan
};
