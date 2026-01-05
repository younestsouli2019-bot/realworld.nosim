import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';
import fs from 'fs';
import path from 'path';

function emailRegex() {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
}

async function listAll(entity, { fields = null, pageSize = 200, sort = "-created_date" } = {}) {
  const out = [];
  let offset = 0;
  for (;;) {
    const page = await entity.list(sort, pageSize, offset, fields ?? undefined);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return out;
}

function extractEmailsFromObject(obj) {
  const emails = new Set();
  const seen = new Set();
  function scan(v) {
    if (v == null) return;
    if (typeof v === 'string') {
      const matches = v.match(emailRegex());
      if (matches) for (const m of matches) emails.add(m.toLowerCase());
      return;
    }
    if (typeof v !== 'object') return;
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const item of v) scan(item);
      return;
    }
    for (const [k, vv] of Object.entries(v)) {
      if (String(k).toLowerCase().includes('email')) {
        if (typeof vv === 'string') emails.add(vv.toLowerCase());
      }
      scan(vv);
    }
  }
  scan(obj);
  return Array.from(emails);
}

async function run() {
  const client = buildBase44Client();
  if (!client) {
    console.error('Base44 not configured; set BASE44_APP_ID and BASE44_SERVICE_TOKEN');
    process.exit(1);
  }
  const cfg = getRevenueConfigFromEnv();
  const entity = client.asServiceRole.entities[cfg.entityName];
  const events = await listAll(entity, { fields: [cfg.fieldMap.metadata, cfg.fieldMap.source, 'id'] });
  const set = new Set();
  for (const e of events) {
    const emails = extractEmailsFromObject(e[cfg.fieldMap.metadata] || {});
    for (const em of emails) set.add(em);
  }
  const outDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'payer-candidates.json');
  const payload = { count: set.size, emails: Array.from(set).sort() };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(outFile);
}

run().catch(e => {
  console.error('EXTRACT_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
