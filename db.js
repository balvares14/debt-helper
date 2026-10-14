const { Pool, types } = require('pg');

// A DATE column is a calendar day, not an instant. Left alone, node-postgres
// turns it into a Date at local midnight, which shifts "2026-09-15" to the
// 14th once the server clock is behind UTC. Hand these back as plain
// 'YYYY-MM-DD' strings and let the planner do calendar math on them.
const PG_TYPE_DATE = 1082;
types.setTypeParser(PG_TYPE_DATE, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }  // Required for AWS RDS
});

module.exports = pool;
