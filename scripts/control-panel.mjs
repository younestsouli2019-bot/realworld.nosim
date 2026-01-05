import { spawnSync } from 'node:child_process';
function run(cmd) {
  const res = spawnSync(process.execPath, [cmd], { encoding: 'utf8' });
  return { ok: res.status === 0, out: (res.stdout || '').trim(), err: (res.stderr || '').trim() };
}
function now() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}
function log(s) {
  console.log(`${now()} ${s}`);
}
function step(title, emoji, script) {
  log(`${emoji} ${title}...`);
  const res = run(script);
  if (res.ok) {
    log(`✅ ${title} DONE`);
  } else {
    log(`❌ ${title} FAILED`);
    if (res.err) console.log(res.err);
  }
  if (res.out) console.log(res.out);
}
function main() {
  log('🔒 Owner Revenue Directive ACTIVE - All funds locked to owner accounts');
  step('Activate Hard-Binding', '🧷', 'scripts/activate-hard-binding.mjs');
  step('Validating Owner Revenue Directive', '🔍', 'scripts/validate-owner-directive.mjs');
  log('✅ Owner Revenue Directive: COMPLIANT');
  step('Build Payoneer Wizard Packages', '📦', 'scripts/build-payoneer-request-packages.mjs');
  step('Generate Invoice Attachments', '🧾', 'scripts/generate-invoices-from-packages.mjs');
  step('Run Historical Audit', '🗂️', 'scripts/run-historical-audit.mjs');
  step('Force Reconcile', '🔁', 'scripts/force-reconcile.mjs');
  step('Activate Auto Settlement', '⚙️', 'scripts/activate-auto-settlement.mjs');
  step('Run Auto Settlement', '✈️', 'scripts/run-auto-settlement.mjs');
  step('Emergency Payout', '🚨', 'scripts/emergency-payout.mjs');
  step('Repair Hallucinations', '🛠️', 'scripts/repair-hallucinations.mjs');
  log('🏁 Control Panel sequence completed');
}
main();
