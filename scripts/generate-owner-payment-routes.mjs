import fs from 'fs';
import path from 'path';
import '../src/load-env.mjs';
import { shouldAvoidPayPal } from '../src/policy/geopolicy.mjs';
import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';
import { buildPayPalMeLink } from '../src/providers/paypal/paypalme.mjs';

function getEnv(name) {
  const v = process.env[name];
  return v == null ? '' : String(v).trim();
}

function bool(name, fallback = false) {
  const v = getEnv(name);
  if (!v) return fallback;
  const s = v.toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function safePush(arr, obj) {
  if (obj && Object.values(obj).some(v => v != null && String(v).trim() !== '')) arr.push(obj);
}

function buildRoutes() {
  const cfg = OwnerSettlementEnforcer.getPaymentConfiguration();
  const avoidPP = shouldAvoidPayPal();
  const routes = [];

  const bank = cfg.settlement_destinations.bank;
  safePush(routes, { method: 'bank_wire', iban: bank, priority: 1, labels: ['Direct', 'Owner Verified'] });

  const payoneerEmail = cfg.settlement_destinations.payoneer;
  const payoneerUk = cfg.settlement_destinations.payoneer_uk_bank;
  const payoneerJp = cfg.settlement_destinations.payoneer_jp_bank;
  const payoneerEu = cfg.settlement_destinations.payoneer_eu_iban;
  safePush(routes, { method: 'payoneer', email: payoneerEmail, priority: 2, labels: ['Direct', 'Owner Verified'] });
  safePush(routes, { method: 'payoneer_bank_uk', identifier: payoneerUk, priority: 2, labels: ['Direct Bank'] });
  safePush(routes, { method: 'payoneer_bank_jp', identifier: payoneerJp, priority: 2, labels: ['Direct Bank'] });
  safePush(routes, { method: 'payoneer_bank_eu', iban: payoneerEu, priority: 2, labels: ['Direct Bank'] });

  const cryptoPrimary = cfg.settlement_destinations.crypto;
  const cryptoBybitErc = cfg.settlement_destinations.crypto_bybit_erc20;
  const cryptoBybitTon = cfg.settlement_destinations.crypto_bybit_ton;
  safePush(routes, { method: 'crypto_wallet', network: 'ERC20/BEP20', coin: 'USDT', address: cryptoPrimary, priority: 3, labels: ['Trust Wallet'] });
  safePush(routes, { method: 'crypto_bybit_erc20', network: 'ERC20', coin: 'USDT', address: cryptoBybitErc, priority: 3, labels: ['Bybit'] });
  safePush(routes, { method: 'crypto_bybit_ton', network: 'TON', coin: 'TON', address: cryptoBybitTon, priority: 3, labels: ['Bybit'] });

  const stripeBank = cfg.settlement_destinations.stripe;
  safePush(routes, { method: 'stripe_bank', iban: stripeBank, priority: 4, labels: ['Stripe via Bank'] });

  const paypalRib = cfg.settlement_destinations.paypal;
  const paypalEmail = getEnv('OWNER_PAYPAL_EMAIL');
  const ppHandle = getEnv('PAYPAL_ME_HANDLE');
  let paypalLink = null;
  if (!avoidPP) {
    if (ppHandle) {
      paypalLink = buildPayPalMeLink({ handle: ppHandle });
    }
  }
  safePush(routes, { method: 'paypal', email: paypalEmail, link: paypalLink, destination: paypalRib, priority: 5, labels: ['Direct', avoidPP ? 'Geo Restricted' : 'Available'] });

  return { routes, cfg };
}

function writeOutput(payload) {
  const root = process.cwd();
  const outDir = path.join(root, 'exports', 'payment-routes');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `owner_payment_routes_${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

async function main() {
  const data = buildRoutes();
  const outPath = writeOutput({ ok: true, ...data, generated_at: new Date().toISOString() });
  process.stdout.write(`${JSON.stringify({ ok: true, filePath: outPath, count: data.routes.length })}\n`);
}

main().catch(e => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: e.message })}\n`);
  process.exitCode = 1;
});
