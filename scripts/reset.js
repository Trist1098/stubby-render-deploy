const { Pool } = require('pg');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const repoRoot = path.join(__dirname, '..');
const schemaPath = path.join(repoRoot, 'schema.sql');

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function dropExistingTables(client) {
  const { rows } = await client.query(`
    SELECT schemaname, tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY schemaname, tablename
  `);

  if (rows.length === 0) {
    console.log('No existing tables found.');
    return;
  }

  const tableNames = rows
    .map(
      ({ schemaname, tablename }) => `${quoteIdentifier(schemaname)}.${quoteIdentifier(tablename)}`,
    )
    .join(', ');

  console.log(`Dropping ${rows.length} existing table(s)...`);
  await client.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
}

async function reset() {
  // Read and execute schema.sql (single source of truth for DB structure)
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();

  console.log('Resetting database schema...');

  try {
    await client.query('BEGIN');
    await dropExistingTables(client);
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('Schema applied.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('Running seed...');
  execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('Database reset completed successfully.');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
