// Database Setup Script
// Creates every table the debt planner needs. Safe to re-run.
// Usage: npm run setup-db

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Order matters: the planner tables reference users.
const SQL_FILES = [
  { file: 'database-setup.sql', required: true },
  { file: 'database-setup-template.sql', required: false }
];

const PLANNER_TABLES = ['users', 'plan_settings', 'debts', 'debt_promos', 'cash_events'];
const TEMPLATE_TABLES = ['permissions', 'miscellaneous'];

async function runSqlFile(client, filename, required) {
  const sqlPath = path.join(__dirname, '..', filename);

  if (!fs.existsSync(sqlPath)) {
    if (required) throw new Error(`Missing ${filename}`);
    console.log(`   – skipped ${filename} (not present)`);
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await client.query(sql);
    console.log(`   ✓ ran ${filename}`);
  } catch (error) {
    if (error.message.includes('permission denied to create extension') ||
        error.message.includes('uuid-ossp')) {
      console.log('⚠️  Could not create the uuid-ossp extension (normal on managed databases).');
      console.log('   The schema uses BIGSERIAL keys, so this is not needed.');
      return;
    }
    throw error;
  }
}

async function setupDatabase() {
  try {
    console.log('📦 Setting up the debt planner database...');
    console.log(`   ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}\n`);

    const client = await pool.connect();
    try {
      // One transaction: a half-applied schema is worse than none.
      await client.query('BEGIN');
      for (const { file, required } of SQL_FILES) {
        await runSqlFile(client, file, required);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const expected = [...PLANNER_TABLES, ...TEMPLATE_TABLES];
    const verifyResult = await pool.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
        ORDER BY table_name`,
      [expected]
    );

    const found = verifyResult.rows.map((row) => row.table_name);

    console.log('\n✅ Planner tables:');
    PLANNER_TABLES.forEach((name) => {
      console.log(`   ${found.includes(name) ? '✓' : '✗'} ${name}`);
    });

    const templateFound = TEMPLATE_TABLES.filter((name) => found.includes(name));
    if (templateFound.length > 0) {
      console.log(`\n   Template demo tables: ${templateFound.join(', ')}`);
    }

    const missing = PLANNER_TABLES.filter((name) => !found.includes(name));
    if (missing.length > 0) {
      console.error(`\n❌ Missing tables: ${missing.join(', ')}`);
      process.exit(1);
    }

    console.log('\nDone. Next: npm run seed-demo (optional sample plan), then npm run dev.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
