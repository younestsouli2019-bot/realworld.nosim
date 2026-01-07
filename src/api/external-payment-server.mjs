import http from 'node:http';
import { ExternalPaymentAPI } from './external-payment-api.mjs';
import { addSecurityHeaders, validateRequest, validateAuth } from '../security-middleware.mjs';
import { handlePayoneerWebhook } from '../real/psp/webhook-handlers.mjs';
import '../load-env.mjs';

function getTokens() {
  const v = process.env.SWARM_INTERNAL_TOKENS || process.env.AGENT_API_TOKENS || '';
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

function readBody(req, limitBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const api = new ExternalPaymentAPI();
await api.initialize();
const tokens = getTokens();
const port = Number(process.env.AGENT_API_PORT || '8088');

const server = http.createServer(async (req, res) => {
  addSecurityHeaders(res);
  const invalid = validateRequest(req);
  if (invalid) {
    json(res, invalid.status, { error: invalid.error });
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    // Webhooks: bypass agent auth, rely on provider verification
    if (req.method === 'POST' && url.pathname === '/webhooks/payoneer') {
      const raw = await readBody(req);
      const r = await handlePayoneerWebhook(req.headers || {}, raw);
      if (r.verified) {
        try { await api.audit.write({ id: `PAYONEER_WH_${Date.now()}`, timestamp: new Date().toISOString(), action: 'PAYONEER_WEBHOOK', entity_id: r?.event?.transaction_id || 'unknown', actor: 'Payoneer', changes: { before: null, after: r }, context: {} }); } catch {}
        json(res, 200, { ok: true });
      } else {
        json(res, 400, { ok: false, error: 'verification_failed' });
      }
      return;
    }
    // Agent API endpoints require auth
    const authOk = validateAuth(req, tokens);
    if (!authOk) {
      json(res, 401, { error: 'unauthorized' });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/settlement/auto') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestAutoSettlement(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/paypal') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestPayPalPayout(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/bank') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestBankWireTransfer(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/crypto') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestCryptoTransfer(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/payoneer') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestPayoneerTransfer(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/stripe') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.requestStripeTransfer(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/payout/status') {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const r = await api.updatePayoutStatus(body);
      json(res, 200, r);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/balance/paypal') {
      const r = await api.getGatewayBalance({ provider: 'paypal', actor: 'AgentAPI' });
      json(res, 200, r);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/audit/verify') {
      const date = url.searchParams.get('date') || '';
      const r = ExternalPaymentAPI.verifyAuditChainForDate(date);
      json(res, 200, r);
      return;
    }
    json(res, 404, { error: 'not_found' });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
});

server.listen(port);
export default server;
