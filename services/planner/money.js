/**
 * All planner arithmetic happens in integer cents.
 *
 * Floating-point dollars drift: a five-year daily projection applies tens of
 * thousands of operations, and "balance is $0.00000001, keep paying" is a real
 * failure mode. Cents in, cents out, round only at the edges.
 */

/** Parses a NUMERIC column (which node-postgres gives us as a string), a
 *  number, or a user-entered string into cents. Non-numeric input is 0. */
function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value * 100);

  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Cents back to a dollar number, for JSON responses. */
function toDollars(cents) {
  return Math.round(cents) / 100;
}

/** Percentage (29.99) to cents of interest for one month on `balanceCents`.
 *  Monthly compounding — surfaced as an assumption in the UI. */
function monthlyInterest(balanceCents, aprPercent) {
  if (balanceCents <= 0 || !aprPercent || aprPercent <= 0) return 0;
  return Math.round((balanceCents * aprPercent) / 1200);
}

function clampToZero(cents) {
  return cents > 0 ? cents : 0;
}

module.exports = { toCents, toDollars, monthlyInterest, clampToZero };
