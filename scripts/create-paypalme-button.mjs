import '../src/load-env.mjs';
import { createPayPalMeButton, awaitInboundPayment } from '../src/providers/paypal/paypalme.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (!n || n.startsWith('--')) {
      args[k] = true;
    } else {
      args[k] = n;
      i++;
    }
  }
  return args;
}

function getBool(v, fallback = false) {
  if (v == null) return fallback;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

async function main() {
  const args = parseArgs(process.argv);
  const amount = args.amount != null ? Number(args.amount) : null;
  const currency = args.currency ? String(args.currency).toUpperCase() : (process.env.PAYPAL_CURRENCY ?? 'USD');
  const memo = args.memo ? String(args.memo) : '';
  const locale = args.locale ? String(args.locale) : '';
  const waitConfirm = getBool(args.waitConfirm, false);
  const timeoutMs = args.timeoutMs != null ? Number(args.timeoutMs) : 600000;
  const pollMs = args.pollMs != null ? Number(args.pollMs) : 30000;

  const btn = createPayPalMeButton({ amount, currency, memo, locale });
  const out = { ok: true, link: btn.link, filePath: btn.filePath };

  if (waitConfirm && amount != null) {
    const proof = await awaitInboundPayment({ amount, currency, timeoutMs, pollIntervalMs: pollMs });
    out.confirmation = proof;
  }

  process.stdout.write(`${JSON.stringify(out)}\n`);
}

main().catch((e) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: e?.message ?? String(e) })}\n`);
  process.exitCode = 1;
});
