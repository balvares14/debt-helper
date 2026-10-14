// Grant or revoke miscellaneous.insert for an existing user (lookup by email).
// Use this after create-user so you can see button 3 fail (403) then succeed.
//
// Usage:
//   npm run grant-insert -- you@example.com
//   npm run grant-insert -- you@example.com --revoke
//
// This writes the app `permissions` table. It is not npm run grant-permissions
// (that one is PostgreSQL role GRANTs for RDS).

require('dotenv').config();
const { Pool } = require('pg');
const CONSTANTS = require('../utils/constants');

const INSERT_PERMISSION = CONSTANTS.PERMISSIONS.MISCELLANEOUS_INSERT;

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const positional = args.filter((arg) => arg !== '--revoke');
const email = positional[0];

if (!email || positional.length !== 1) {
  console.error('Usage: npm run grant-insert -- <email> [--revoke]');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('Invalid email format.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function grantInsert() {
  const client = await pool.connect();
  try {
    const normalizedEmail = email.toLowerCase();
    const found = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (found.rows.length === 0) {
      console.error(`No user with email: ${normalizedEmail}`);
      process.exit(1);
    }

    const user = found.rows[0];

    if (revoke) {
      const deleted = await client.query(
        `DELETE FROM permissions
         WHERE user_id = $1 AND permission = $2
         RETURNING permission`,
        [user.id, INSERT_PERMISSION]
      );

      if (deleted.rowCount === 0) {
        console.log(`${user.email} did not have ${INSERT_PERMISSION}.`);
      } else {
        console.log(`Revoked ${INSERT_PERMISSION} from ${user.email}.`);
      }
    } else {
      const inserted = await client.query(
        `INSERT INTO permissions (user_id, permission)
         VALUES ($1, $2)
         ON CONFLICT (user_id, permission) DO NOTHING
         RETURNING permission`,
        [user.id, INSERT_PERMISSION]
      );

      if (inserted.rowCount === 0) {
        console.log(`${user.email} already has ${INSERT_PERMISSION}.`);
      } else {
        console.log(`Granted ${INSERT_PERMISSION} to ${user.email}.`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to update permission:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

grantInsert();
