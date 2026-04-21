const fs = require('fs');
const path = require('path');

const dirs = [path.join(__dirname, '..', 'test-results')];

for (const dir of dirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // OneDrive may hold a lock on this folder – safe to ignore
  }
}
