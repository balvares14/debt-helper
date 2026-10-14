// Create a user from the terminal. There is no public POST /api/auth/register.
// Usage:
//   npm run create-user -- email@example.com secretpassword First Last
//   npm run create-user -- email@example.com secretpassword First Last --grant-insert
//
// --grant-insert also adds miscellaneous.insert (Insert Item button 3).
// Prefer creating without it, then: npm run grant-insert -- email@example.com
// Password is bcrypt-hashed (same as the old register route). Do not INSERT
// plaintext passwords in SQL or login will never match.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const CONSTANTS = require('../utils/constants');

const INSERT_PERMISSION = CONSTANTS.PERMISSIONS.MISCELLANEOUS_INSERT;

const args = process.argv.slice(2);
const grantInsert = args.includes('--grant-insert');
const positional = args.filter((arg) => arg !== '--grant-insert');
const [email, password, firstName, lastName] = positional;

if (!email || !password || !firstName || !lastName) {
  console.error('Usage: npm run create-user -- <email> <password> <firstName> <lastName> [--grant-insert]');
  process.exit(1);
}

if (password.length < CONSTANTS.MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${CONSTANTS.MIN_PASSWORD_LENGTH} characters.`);
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

async function createUser() {
  const client = await pool.connect();
  try {
    const normalizedEmail = email.toLowerCase();

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      console.error(`User already exists: ${normalizedEmail}`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await client.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, first_name, last_name`,
      [normalizedEmail, firstName, lastName, passwordHash]
    );

    const user = inserted.rows[0];

    if (grantInsert) {
      await client.query(
        `INSERT INTO permissions (user_id, permission)
         VALUES ($1, $2)
         ON CONFLICT (user_id, permission) DO NOTHING`,
        [user.id, INSERT_PERMISSION]
      );
    }

    console.log('User created.');
    console.log(`  id:    ${user.id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  name:  ${user.first_name} ${user.last_name}`);
    if (grantInsert) {
      console.log(`  permission: ${INSERT_PERMISSION}`);
    }
    console.log(`\nLog in at http://localhost:${process.env.FRONTEND_PORT || 3000}/auth`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createUser();
