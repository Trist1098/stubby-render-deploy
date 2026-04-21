const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reset() {
  // Read and execute schema.sql (single source of truth for DB structure)
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  console.log('Resetting database schema...');
  await pool.query(schemaSql);
  console.log('Schema applied.');

  // Close pool before running seed script
  await pool.end();

  console.log('Running seed...');
  execSync('node scripts/seed.js', { stdio: 'inherit', env: process.env });

  console.log('Database reset completed successfully.');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  pool.end();
  process.exit(1);
});
