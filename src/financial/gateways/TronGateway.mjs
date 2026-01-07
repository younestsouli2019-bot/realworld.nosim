import https from 'https';
import fs from 'fs';
import path from 'path';

function buildQuery(params) {
  const keys = Object.keys(params).filter((k) => params[k] != null);
  return keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
}

function getJson(hostname, pathname, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = buildQuery(params);
    const fullPath = `${pathname}${qs ? `?${qs}` : ''}`;
    const options = { hostname, port: 443, path: fullPath, method: 'GET', headers: { 'Accept': 'application/json' } };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(String(data || '{}'));
          resolve(j);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export class TronGateway {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'settlements', 'tron');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    this._state = { last: {}, misses: {} };
  }

  async generateInstructions(transactions) {
    const t = transactions?.[0] || {};
    const amount = Number(t.amount || 0);
    const currency = t.currency || 'USDT';
    const address = process.env.OWNER_TRON_USDT_ADDRESS || t.destination;
    const filename = `tron_instruction_${Date.now()}.json`;
    const filePath = path.join(this.outputDir, filename);
    const instruction = {
      type: 'TRON_USDT_RECEIVE',
      address,
      amount,
      currency,
      provider_hint: 'Wirex/Tron Wallet',
      status: 'WAITING_MANUAL_EXECUTION',
      created_at: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(instruction, null, 2));
    return { status: 'INSTRUCTIONS_READY', filePath, instruction };
  }

  async checkIncoming({ address, minAmount = 0, limit = 20 } = {}) {
    if (!address) return { status: 'invalid', error: 'missing_address' };
    const now = Date.now();
    const akey = String(address).toLowerCase();
    const lastTs = this._state.last[akey] || 0;
    const misses = this._state.misses[akey] || 0;
    const base = 1000;
    const extra = Math.min(5000, misses * 500);
    const minInterval = base + extra;
    if (now - lastTs < minInterval) {
      return { status: 'cached', next_query_in_ms: minInterval - (now - lastTs) };
    }
    try {
      const data = await getJson('apilist.tronscan.org', '/api/token_trc20/transfers', { limit, sort: '-timestamp', relatedAddress: address });
      const list = Array.isArray(data?.token_transfers) ? data.token_transfers : [];
      const usdt = list.filter((t) => String(t?.to_address || '').toLowerCase() === String(address).toLowerCase() && (t.tokenInfo?.tokenAbbr === 'USDT' || t.tokenName === 'Tether USD'));
      const match = usdt.find((t) => Number(t?.quant || t?.amount || 0) >= Number(minAmount));
      this._state.last[akey] = now;
      if (!match) {
        this._state.misses[akey] = misses + 1;
        return { status: 'not_found' };
      }
      this._state.misses[akey] = 0;
      return {
        status: 'RECEIVED',
        txId: match.transaction_id || match.txHash || null,
        amount: Number(match?.quant || match?.amount || 0),
        timestamp: match?.timestamp || null,
        from: match?.from_address || null,
        to: match?.to_address || null
      };
    } catch (e) {
      this._state.last[akey] = now;
      return { status: 'error', error: e?.message || String(e) };
    }
  }
}
