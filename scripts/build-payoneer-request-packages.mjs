import fs from 'fs';
import path from 'path';

function findCsvFiles(dir) {
  try {
    const full = path.resolve(dir);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full)
      .filter(f => f.toLowerCase().endsWith('.csv'))
      .map(f => path.join(full, f));
  } catch {
    return [];
  }
}

function parseCsv(content) {
  const lines = String(content || '').split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j].trim()] = (cols[j] || '').trim();
    }
    rows.push(obj);
  }
  return rows;
}

function ensureDir(p) {
  const dir = path.resolve(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function inferCurrency(row) {
  return row.Currency || row.currency || 'USD';
}

function inferAmount(row) {
  const val = row.Amount || row.amount;
  return val ? Number(val) : 0;
}

function inferPayee(row) {
  return row.PayeeID || row.PayerEmail || row.ClientToBill || row.receiver || '';
}

function inferDescription(row) {
  return row.Description || row.description || 'Service Payment Request';
}

function buildPackageFromRow(row) {
  const email = inferPayee(row);
  const amount = inferAmount(row);
  const currency = inferCurrency(row);
  const description = inferDescription(row);
  return {
    payer: {
      email,
      name: 'Client',
      company: 'Client Company',
      address: {
        line1: '',
        city: '',
        country: ''
      }
    },
    request: {
      amount,
      currency,
      description,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    attachments: [],
    notes: {
      verification_proof_hint: 'Attach PSP Transaction ID / Settlement ID / Bank Reference if available'
    }
  };
}

async function run() {
  const payoneerCsvDir = path.join(process.cwd(), 'settlements', 'payoneer');
  const bankCsvDir = path.join(process.cwd(), 'settlements', 'bank_wires');
  const outDir = path.join(process.cwd(), 'exports', 'payoneer-wizard');
  ensureDir(outDir);
  const files = [
    ...findCsvFiles(payoneerCsvDir),
    ...findCsvFiles(bankCsvDir)
  ];
  const packages = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rows = parseCsv(content);
    for (const row of rows) {
      packages.push(buildPackageFromRow(row));
    }
  }
  const indexFile = path.join(outDir, `packages_${Date.now()}.json`);
  fs.writeFileSync(indexFile, JSON.stringify({ count: packages.length, packages }, null, 2));
  console.log(indexFile);
}

run().catch(e => {
  console.error('BUILD_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
