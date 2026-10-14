// Grant Permissions Script
// Run this script as a superuser to grant necessary permissions to a regular user
// Usage: 
//   npm run grant-permissions
//   Or: TARGET_USER=test_user npm run grant-permissions

require('dotenv').config();
const { Pool } = require('pg');

// Get target user from environment variable or command line argument
const targetUser = process.env.TARGET_USER || process.argv[2];

if (!targetUser) {
  console.error('❌ Error: Target user not specified');
  console.log('\nUsage:');
  console.log('  TARGET_USER=test_user npm run grant-permissions');
  console.log('  Or: npm run grant-permissions test_user');
  process.exit(1);
}

// Validate username to prevent SQL injection (alphanumeric, underscore, and hyphen only)
if (!/^[a-zA-Z0-9_-]+$/.test(targetUser)) {
  console.error('❌ Error: Invalid username format. Username can only contain letters, numbers, underscores, and hyphens.');
  process.exit(1);
}

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

async function grantPermissions() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 Granting permissions...');
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Target User: ${targetUser}`);
    console.log(`Connecting as: ${process.env.DB_USER}`);
    console.log('');

    // Check if user exists
    const userCheck = await client.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [targetUser]
    );

    if (userCheck.rows.length === 0) {
      console.error(`❌ Error: User '${targetUser}' does not exist`);
      console.log('\nCreate the user first with:');
      console.log(`  CREATE USER ${targetUser} WITH PASSWORD 'your_password';`);
      process.exit(1);
    }

    // Escape the username for SQL (it's already validated, but we'll quote it properly)
    const quotedUser = `"${targetUser}"`;

    // Grant schema permissions
    // Note: GRANT statements don't support parameterized queries for role names,
    // so we use string interpolation after validation
    console.log('📋 Granting schema permissions...');
    await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedUser}`);
    await client.query(`GRANT CREATE ON SCHEMA public TO ${quotedUser}`);
    console.log('  ✓ USAGE and CREATE on public schema');

    // Grant permissions on existing objects
    console.log('📋 Granting permissions on existing objects...');
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${quotedUser}`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${quotedUser}`);
    await client.query(`GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${quotedUser}`);
    console.log('  ✓ Tables, sequences, and functions');

    // Set default privileges for future objects
    console.log('📋 Setting default privileges for future objects...');
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${quotedUser}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${quotedUser}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${quotedUser}`);
    console.log('  ✓ Default privileges set');

    // Verify permissions
    console.log('\n🔍 Verifying permissions...');
    const verifyUsage = await client.query(
      'SELECT has_schema_privilege($1, $2, $3) as has_privilege',
      [targetUser, 'public', 'USAGE']
    );
    const verifyCreate = await client.query(
      'SELECT has_schema_privilege($1, $2, $3) as has_privilege',
      [targetUser, 'public', 'CREATE']
    );

    console.log(`  USAGE: ${verifyUsage.rows[0].has_privilege ? '✅' : '❌'}`);
    console.log(`  CREATE: ${verifyCreate.rows[0].has_privilege ? '✅' : '❌'}`);

    if (verifyUsage.rows[0].has_privilege && verifyCreate.rows[0].has_privilege) {
      console.log('\n✅ Permissions granted successfully!');
      console.log(`\nUser '${targetUser}' can now:`);
      console.log('  - Create tables, functions, triggers in the public schema');
      console.log('  - Use existing objects in the public schema');
      console.log('  - Create and manage sequences');
      console.log('\nYou can now run: npm run setup-db');
    } else {
      console.error('\n❌ Warning: Some permissions may not have been granted correctly');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    if (error.message.includes('permission denied') || error.message.includes('must be owner')) {
      console.error('❌ Error: Insufficient privileges');
      console.error('   This script must be run as a superuser (e.g., rds_superuser)');
      console.error(`   Current user: ${process.env.DB_USER}`);
      console.error('\n   Please connect as a superuser and run the grant commands manually,');
      console.error('   or update your .env file to use superuser credentials temporarily.');
    } else {
      console.error('❌ Error granting permissions:', error.message);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

grantPermissions();
