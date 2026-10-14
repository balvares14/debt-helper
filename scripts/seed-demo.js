/**
 * Loads the sample plan for one user, from the command line.
 *
 * The app can do this from the UI, but this is useful for checking the
 * database end of things without opening a browser.
 *
 * Usage: npm run seed-demo -- you@example.com
 */

require('dotenv').config();

const pool = require('../db');
const repository = require('../services/planner/repository');
const { buildDemoPlan } = require('../services/planner/demoData');
const { buildPlan } = require('../services/planner');
const dates = require('../services/planner/dates');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    console.error('Usage: npm run seed-demo -- you@example.com');
    console.error('Create the user first with: npm run create-user');
    process.exit(1);
  }

  const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
  if (rows.length === 0) {
    console.error(`No user with email ${email}.`);
    console.error('Create one with: npm run create-user');
    process.exit(1);
  }

  const user = rows[0];
  const today = dates.todayISO();

  console.log(`Loading the demo plan for ${user.email}…`);
  await repository.replacePlan(user.id, buildDemoPlan(today));

  const plan = await buildPlan(user.id, { today });
  const { summary } = plan.projection;

  console.log('\nSeeded:');
  console.log(`  cash on hand    $${summary.cashOnHand}`);
  console.log(`  total debt      $${summary.totalDebt}`);
  console.log(`  debt free       ${summary.debtFreeDate ?? 'over 5 years'}`);
  console.log(`  interest left   $${summary.interestRemaining}`);
  console.log(`  interest saved  $${summary.interestSaved} vs minimums only`);
  console.log(`  lowest cash     $${summary.lowestCash} on ${summary.lowestCashDate}`);

  if (plan.projection.banners.length > 0) {
    console.log('\nBanners:');
    plan.projection.banners.forEach((banner) => {
      console.log(`  [${banner.level}] ${banner.title}`);
    });
  }

  console.log('\nOpen the app and log in as this user to see the calendar.');
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('❌ Seed failed:', error.message);
    await pool.end();
    process.exit(1);
  });
