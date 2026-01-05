import fs from 'fs';
import path from 'path';

function readOffline() {
  const p = path.join(process.cwd(), 'doomsday-vault', 'ledger-dump-2026-01-05T16-07-01-335Z', 'base44-offline-store.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function summarize(records) {
  let total = 0;
  let verified = 0;
  let verifiedAmt = 0;
  let hallucinated = 0;
  let hallucinatedAmt = 0;
  for (const r of records) {
    total++;
    const amt = Number(r.amount || 0);
    const s = (r.status || '').toLowerCase();
    if (s === 'verified' || s === 'paid_out' || s === 'settled') {
      verified++;
      verifiedAmt += amt;
    } else if (s === 'hallucination') {
      hallucinated++;
      hallucinatedAmt += amt;
    }
  }
  const coverage = total > 0 ? ((verified / total) * 100) : 0;
  return { total, verified, verifiedAmt, hallucinated, hallucinatedAmt, coverage };
}

function run() {
  const store = readOffline();
  if (!store) {
    console.log('NO_OFFLINE_STORE');
    return;
  }
  const recs = store.entities?.RevenueEvent?.records || [];
  const s = summarize(recs);
  const out = path.join(process.cwd(), 'exports', 'historical-audit-summary.json');
  if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(s, null, 2));
  console.log(out);
}

run();
