'use strict';
// Execute files sequentially; quick exclusions are NOT RUN, never successes.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const MAP_E2E = ['e2e-browser-map.test.cjs', 'e2e-nearby-markers.test.cjs'];
function parseSummary(output) {
  const result = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...output.matchAll(new RegExp('^# ' + key + ' (\\d+)\\s*$', 'gm'))];
    result[key] = matches.length ? Number(matches.at(-1)[1]) : null;
  }
  return result;
}
function run(mode) {
  if (!['quick', 'full'].includes(mode)) throw Error('usage: node scripts/run-tests.cjs quick|full');
  const root = path.join(__dirname, '..'), dir = path.join(root, 'tests');
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs')).sort();
  const notRun = mode === 'quick' ? all.filter(f => MAP_E2E.includes(f)) : [];
  const files = all.filter(f => !notRun.includes(f));
  const destination = path.join(root, 'scratch', 'test-runs', new Date().toISOString().replace(/[:.]/g, '-') + '-' + mode);
  fs.mkdirSync(destination, { recursive: true });
  const results = [];
  const totals = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const file of files) {
    const started = Date.now();
    const child = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-timeout=180000', path.join(dir, file)], {
      encoding: 'utf8', cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      timeout: 210000, env: { ...process.env, ONSEN_E2E_TRACE: '1' }
    });
    const output = (child.stdout || '') + (child.stderr || '');
    fs.writeFileSync(path.join(destination, file + '.log'), output);
    const counts = parseSummary(output);
    const complete = Object.values(counts).every(n => n !== null);
    const infrastructureError = child.error?.message || (!complete ? 'Missing TAP summary; result is incomplete' : null);
    const outcome = infrastructureError ? 'incomplete' : counts.cancelled > 0 ? 'cancelled' : child.status !== 0 || counts.fail > 0 ? 'failed' : counts.skipped > 0 || counts.todo > 0 ? 'skipped' : 'passed';
    const success = outcome === 'passed';
    for (const key of Object.keys(totals)) totals[key] += counts[key] ?? 0;
    const result = { file, success, outcome, exitCode: child.status, signal: child.signal, durationMs: Date.now() - started, counts, infrastructureError };
    results.push(result);
    console.log(`${outcome.toUpperCase()} ${file}: tests=${counts.tests ?? '?'}, pass=${counts.pass ?? '?'}, fail=${counts.fail ?? '?'}, cancelled=${counts.cancelled ?? '?'}, skipped=${counts.skipped ?? '?'}`);
    if (!success) console.error(output + (infrastructureError ? '\n' + infrastructureError : ''));
  }
  const report = { mode, totalFiles: all.length, executedFiles: results.length, passedFiles: results.filter(r => r.success).length,
    failedFiles: results.filter(r => r.outcome === 'failed').length, cancelledFiles: results.filter(r => r.outcome === 'cancelled').length,
    skippedFiles: results.filter(r => r.outcome === 'skipped').length, incompleteFiles: results.filter(r => r.outcome === 'incomplete').length,
    notRunFiles: notRun, totals, results,
    complete: results.every(r => !r.infrastructureError), passed: results.every(r => r.success) };
  fs.writeFileSync(path.join(destination, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'scratch', 'test-runs', 'latest-' + mode + '.json'), JSON.stringify({ directory: destination, ...report }, null, 2) + '\n');
  console.log(`\n[${mode}] FILES: total=${report.totalFiles}, executed=${report.executedFiles}, passed=${report.passedFiles}, failed=${report.failedFiles}, cancelled=${report.cancelledFiles}, skipped=${report.skippedFiles}, incomplete=${report.incompleteFiles}, NOT RUN=${notRun.length}`);
  console.log(`TESTS in executed files: total=${totals.tests}, passed=${totals.pass}, failed=${totals.fail}, cancelled=${totals.cancelled}, skipped=${totals.skipped}, todo=${totals.todo}`);
  if (notRun.length) console.log('NOT RUN FILES (test case count unknown; not counted as passed): ' + notRun.join(', '));
  console.log('Report: ' + path.join(destination, 'summary.json'));
  return report;
}
if (require.main === module) {
  try { process.exitCode = run(process.argv[2] || 'quick').passed ? 0 : 1; }
  catch (error) { console.error(error); process.exitCode = 2; }
}
module.exports = { parseSummary, run };
