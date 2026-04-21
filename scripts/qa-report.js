const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────
const root = path.join(__dirname, '..');
const reportsDir = path.join(root, 'reports');

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// ── Console capture ──────────────────────────────────────
// Captures all output so we can save it as an HTML report at the end.
const lines = [];
const origLog = console.log.bind(console);
console.log = (...args) => {
  const line = args.join(' ');
  lines.push(line);
  origLog(...args);
};

const divider = '='.repeat(60);
const pipelineResults = [];
let pipelineFailures = 0;

/** Run a shell command and track the result */
function run(label, cmd, opts = {}) {
  console.log(`\n${label}\n`);
  try {
    const output = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe', ...opts });
    console.log(output);
    pipelineResults.push({ step: label, status: 'PASS' });
    return { success: true, output };
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    console.log(output);
    if (opts.allowFail) {
      pipelineResults.push({ step: label, status: 'WARN' });
      return { success: false, output };
    }
    pipelineResults.push({ step: label, status: 'FAIL' });
    pipelineFailures++;
    return { success: false, output };
  }
}

// ═════════════════════════════════════════════════════════
//  HEADER
// ═════════════════════════════════════════════════════════
console.log(divider);
console.log('  QA REPORT');
console.log(`  Generated: ${new Date().toISOString()}`);
console.log(divider);

// ═════════════════════════════════════════════════════════
//  AUTOMATED QA CHECKS
// ═════════════════════════════════════════════════════════
console.log(`\n${'─'.repeat(60)}`);
console.log('  AUTOMATED QA CHECKS');
console.log('─'.repeat(60));

// ── 1. ESLint ────────────────────────────────────────────
run('1. LINT (eslint)', 'npx eslint -c configs/eslint.config.mjs .');

let lintJsonStr;
try {
  lintJsonStr = execSync('npx eslint -c configs/eslint.config.mjs . --format json', {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
} catch (err) {
  lintJsonStr = err.stdout || '[]';
}

// Show only failed rules with file/line details
try {
  const lintResults = JSON.parse(lintJsonStr);
  const ruleViolations = new Map();
  for (const file of lintResults) {
    for (const msg of file.messages) {
      if (!msg.ruleId) continue;
      if (!ruleViolations.has(msg.ruleId)) ruleViolations.set(msg.ruleId, []);
      ruleViolations.get(msg.ruleId).push({
        file: path.relative(root, file.filePath),
        line: msg.line,
      });
    }
  }

  if (ruleViolations.size === 0) {
    console.log('\n   [PASS] No ESLint rule violations found.');
  } else {
    console.log(`\n   Failed ESLint Rules (${ruleViolations.size}):`);
    for (const [rule, violations] of ruleViolations) {
      console.log(
        `\n   [FAIL] ${rule} (${violations.length} violation${violations.length > 1 ? 's' : ''})`,
      );
      for (const v of violations) {
        console.log(`          ${v.file}:${v.line}`);
      }
    }
  }
} catch {
  // ignore detailed parse errors
}

// Generate HTML report regardless of pass/fail
try {
  execSync(
    'npx eslint -c configs/eslint.config.mjs . --format html --output-file reports/eslint-report.html',
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  );
} catch {
  // HTML is still written on lint errors
}

// ── 2. Prettier ──────────────────────────────────────────
run('2. FORMAT CHECK (prettier)', 'npx prettier --check .');

// Show per-file format check results
try {
  execSync('npx prettier --list-different .', { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  console.log('   [PASS] All files match Prettier code style');
} catch (err) {
  const failedFiles = (err.stdout || '').trim().split('\n').filter(Boolean);
  if (failedFiles.length > 0) {
    console.log('\n   Files with formatting issues:');
    for (const f of failedFiles) {
      console.log(`   [FAIL] ${f}`);
    }
  }
}

// ── 3. Unit + Integration Tests ──────────────────────────
run(
  '3. UNIT + INTEGRATION TESTS (jest --coverage)',
  'npx dotenv -e .env.test -- npx jest --testPathPatterns=__tests__/unit --silent && dotenv -e .env.test -- jest --testPathPatterns=__tests__/integration --globalSetup=./configs/jest-integration-setup.js --silent --coverage --coverageReporters=text --coverageReporters=html --coverageReporters=lcov',
);

// ── 4. Playwright E2E ────────────────────────────────────
// Clean stale test-results before Playwright (avoids OneDrive lock issues)
try {
  execSync('node scripts/clean-test-results.js', { cwd: root, stdio: 'pipe' });
} catch {
  // safe to ignore
}
run('4. E2E TESTS (playwright)', 'npm run test:e2e');

// Generate Playwright HTML report (always, even if tests failed)
try {
  execSync('npx playwright test --config=configs/playwright.config.js --reporter=html', {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never' },
  });
} catch {
  // HTML report is still generated on test failure
}

// ═════════════════════════════════════════════════════════
//  QA SUMMARY
// ═════════════════════════════════════════════════════════
console.log(`\n${divider}`);
console.log('  QA SUMMARY');
console.log(divider);

for (const r of pipelineResults) {
  console.log(`   [${r.status}] ${r.step}`);
}

console.log(`\n${divider}`);
console.log('  REPORTS');
console.log(divider);
console.log(`   playwright-report/index.html    (E2E test report)`);
console.log(`   coverage-report/index.html      (HTML coverage report)`);
console.log(`   coverage-report/lcov.info       (LCOV for CI integration)`);
console.log(`   reports/eslint-report.html      (lint analysis)`);
console.log(`   reports/qa-report.html          (this combined report)`);
console.log(divider);

// ── Overall result ───────────────────────────────────────
const overallFail = pipelineFailures > 0;

if (overallFail) {
  console.log(`\n   ${pipelineFailures} pipeline step(s) FAILED.`);
  console.log('');
} else {
  console.log('\n   All automated QA checks passed.\n');
}

// ── Save HTML report ─────────────────────────────────────
function buildHtml(title, content) {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[PASS]/g, '<span style="color:#22c55e;font-weight:bold">[PASS]</span>')
    .replace(/\[FAIL]/g, '<span style="color:#ef4444;font-weight:bold">[FAIL]</span>')
    .replace(/\[WARN]/g, '<span style="color:#eab308;font-weight:bold">[WARN]</span>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', monospace; background: #1e1e2e; color: #cdd6f4; padding: 2rem; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.6; }
    h1 { color: #89b4fa; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <pre>${escaped}</pre>
</body>
</html>`;
}

fs.writeFileSync(path.join(reportsDir, 'qa-report.html'), buildHtml('QA Report', lines.join('\n')));

console.log = origLog;
console.log('HTML report saved: reports/qa-report.html');

if (overallFail) {
  process.exit(1);
}
