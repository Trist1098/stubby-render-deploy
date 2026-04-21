const { execSync } = require('child_process');

module.exports = async () => {
  // Set environment to 'test' and load .env.test
  console.log('Setting environment to test');

  // Run database reset (drop, migrate, seed) for the test database
  console.log('Running migrations for test environment...');
  execSync('node scripts/reset.js', { stdio: 'inherit', env: process.env });
};
