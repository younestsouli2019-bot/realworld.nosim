import fs from 'fs';
import path from 'path';
import { shouldAvoidPayPal } from '../../policy/geopolicy.mjs';
import { threatMonitor } from '../../security/threat-monitor.mjs';
import { searchTransactions } from '../../paypal-api.mjs';

function getEnv(name) {
  const v = process.env[name];
  return v == null ? '' : String(v).trim();
}

function requireEnv(name) {
  const v = getEnv(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function formatAmountForLink(amount) {
  const n = Number(amount);
  if (!n || Number.isNaN(n) || n <= 0) throw new Error('Invalid amount');
  const s = n.toFixed(2);
  return s.endsWith('.00') ? String(Math.round(n)) : s.replace(/0+$/, '').replace(/\.$/, '');
}

export function buildPayPalMeLink({ handle, amount, locale } = {}) {
  const h = String(handle ?? '').trim();
  if (!h) throw new Error('Missing PayPal.Me handle');
  const a = amount != null ? formatAmountForLink(amount) : null;
  const base = `https://paypal.me/${encodeURIComponent(h)}${a ? `/${a}` : ''}`;
  const loc = String(locale ?? '').trim();
  return loc ? `${base}?locale.x=${encodeURIComponent(loc)}` : base;
}

export function createPayPalMeButton({ amount, currency, memo, locale } = {}) {
  if (threatMonitor.isBunkerMode()) {
    throw new Error('PAYMENT_BLOCKED_BUNKER_MODE');
  }
  if (shouldAvoidPayPal()) {
    throw new Error('PAYPAL_DISABLED_BY_GEOPOLICY');
  }
  const handle = requireEnv('PAYPAL_ME_HANDLE');
  const link = buildPayPalMeLink({ handle, amount, locale });
  const outDir = path.join(process.cwd(), 'exports', 'receipts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const outPath = path.join(outDir, `paypalme_button_${ts}.json`);
  const payload = {
    kind: 'paypalme_button',
    link,
    amount: amount != null ? Number(amount) : null,
    currency: currency ?? process.env.PAYPAL_CURRENCY ?? 'USD',
    memo: memo ?? '',
    owner_email: getEnv('OWNER_PAYPAL_EMAIL'),
    handle,
    created_at: new Date(ts).toISOString()
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  return { ok: true, link, filePath: outPath };
}

export async function awaitInboundPayment({ amount, currency, timeoutMs = 600000, pollIntervalMs = 30000 } = {}) {
  const targetAmount = Number(amount);
  const targetCurrency = String(currency ?? process.env.PAYPAL_CURRENCY ?? 'USD').toUpperCase();
  if (!targetAmount || Number.isNaN(targetAmount) || targetAmount <= 0) throw new Error('Invalid amount');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const endDate = new Date().toISOString();
    const d = new Date();
    d.setHours(d.getHours() - 2);
    const startDate = d.toISOString();
    const res = await searchTransactions({ startDate, endDate, fields: 'all' });
    const list = Array.isArray(res?.transaction_details) ? res.transaction_details : [];
    const hit = list.find((t) => {
      const info = t?.transaction_info ?? {};
      const amt = Number(info?.transaction_amount?.value ?? 0);
      const cur = String(info?.transaction_amount?.currency_code ?? '').toUpperCase();
      const status = String(info?.transaction_status ?? '').toUpperCase();
      const receiver = String(t?.payee?.email_address ?? '').toLowerCase();
      const owner = String(process.env.OWNER_PAYPAL_EMAIL ?? '').toLowerCase();
      return amt === targetAmount && cur === targetCurrency && status === 'COMPLETED' && (!owner || receiver === owner);
    });
    if (hit) {
      return { ok: true, confirmed: true, transaction: hit };
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return { ok: false, confirmed: false, error: 'timeout' };
}
