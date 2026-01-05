import fs from 'fs';
import path from 'path';

function ensureDir(p) {
  const dir = path.resolve(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitize(s) {
  return String(s || '').replace(/[<>]/g, '');
}

function renderHtml(pkg, idx) {
  const email = sanitize(pkg?.payer?.email);
  const name = sanitize(pkg?.payer?.name);
  const company = sanitize(pkg?.payer?.company);
  const amount = sanitize(pkg?.request?.amount);
  const currency = sanitize(pkg?.request?.currency);
  const description = sanitize(pkg?.request?.description);
  const due = sanitize(pkg?.request?.due_date);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${idx}</title><style>body{font-family:Arial;margin:40px}h1{margin-bottom:4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}</style></head><body><h1>Invoice</h1><p>Payer: ${name} (${company}) &lt;${email}&gt;</p><table><tr><th>Description</th><th>Amount</th><th>Currency</th><th>Due Date</th></tr><tr><td>${description}</td><td>${amount}</td><td>${currency}</td><td>${due}</td></tr></table><p>Notes: Attach PSP Transaction ID / Settlement ID / Bank Reference if available.</p></body></html>`;
}

async function run() {
  const dir = path.join(process.cwd(), 'exports', 'payoneer-wizard');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('NO_PACKAGES');
    return;
  }
  const latest = files.sort().pop();
  const data = JSON.parse(fs.readFileSync(path.join(dir, latest), 'utf8'));
  const outDir = path.join(process.cwd(), 'exports', 'invoices');
  ensureDir(outDir);
  let i = 1;
  for (const pkg of data.packages || []) {
    const html = renderHtml(pkg, i);
    const file = path.join(outDir, `invoice_${i}.html`);
    fs.writeFileSync(file, html);
    i++;
  }
  console.log(outDir);
}

run().catch(e => {
  console.error('GEN_INVOICES_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
