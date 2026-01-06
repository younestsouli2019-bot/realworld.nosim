import net from 'node:net';
import { ExternalPaymentAPI } from './external-payment-api.mjs';

function tokens() {
  const v = process.env.SWARM_INTERNAL_TOKENS || process.env.AGENT_API_TOKENS || '';
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

function parseLines(onLine) {
  let buf = '';
  return (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) onLine(line);
    }
  };
}

const api = new ExternalPaymentAPI();
await api.initialize();
const pipe = process.env.AGENT_IPC_PIPE || '\\\\.\\pipe\\SwarmExternalPayment';
const tok = tokens();

const server = net.createServer((socket) => {
  const onLine = parseLines(async (line) => {
    let req;
    try { req = JSON.parse(line); } catch { socket.write(JSON.stringify({ error: 'bad_json' }) + '\n'); return; }
    const t = String(req.token || '');
    if (!tok.includes(t)) { socket.write(JSON.stringify({ error: 'unauthorized' }) + '\n'); return; }
    const p = String(req.path || '');
    const body = req.body || {};
    try {
      if (p === '/settlement/auto') {
        const r = await api.requestAutoSettlement(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/paypal') {
        const r = await api.requestPayPalPayout(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/bank') {
        const r = await api.requestBankWireTransfer(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/crypto') {
        const r = await api.requestCryptoTransfer(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/payoneer') {
        const r = await api.requestPayoneerTransfer(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/stripe') {
        const r = await api.requestStripeTransfer(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/payout/status') {
        const r = await api.updatePayoutStatus(body);
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/balance/paypal') {
        const r = await api.getGatewayBalance({ provider: 'paypal', actor: 'AgentIPC' });
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      if (p === '/audit/verify') {
        const r = ExternalPaymentAPI.verifyAuditChainForDate(String(body.date || ''));
        socket.write(JSON.stringify(r) + '\n');
        return;
      }
      socket.write(JSON.stringify({ error: 'not_found' }) + '\n');
    } catch (e) {
      socket.write(JSON.stringify({ error: String(e.message || e) }) + '\n');
    }
  });
  socket.on('data', onLine);
});

server.on('listening', () => {
  console.log(`IPC listening on ${pipe}`);
});
server.on('error', (e) => {
  console.error(`IPC error: ${e.message}`);
});
server.listen(pipe);
process.stdin.resume();
export default server;
