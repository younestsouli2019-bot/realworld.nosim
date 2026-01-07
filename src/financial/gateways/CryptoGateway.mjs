import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import '../../load-env.mjs';

function getServerTime() {
  return new Promise((resolve, reject) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(String(data || '{}'));
          resolve(Number(j.serverTime || 0));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function signQuery(secret, params) {
  const keys = Object.keys(params).sort((a, b) => a.localeCompare(b));
  const qs = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const sig = crypto.createHmac('sha256', secret).update(qs).digest('hex');
  return { qs, sig };
}

function apiRequest(endpoint, params, method = 'GET') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    if (!apiKey || !apiSecret) return reject(new Error('MISSING_BINANCE_KEYS'));
    const { qs, sig } = signQuery(apiSecret, params);
    const path = `${endpoint}?${qs}&signature=${sig}`;
    const options = {
      hostname: 'api.binance.com',
      port: 443,
      path,
      method,
      headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(String(data || '{}'));
          if (j.code && j.code !== 200) return reject(new Error(`Binance Error ${j.code}: ${j.msg}`));
          resolve(j);
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function withdrawUSDTBEP20(address, amount) {
  const serverTime = await getServerTime().catch(() => 0);
  const localTime = Date.now();
  const timestamp = localTime + (serverTime ? serverTime - localTime : 0);
  const recvWindow = Number(process.env.BINANCE_RECV_WINDOW_MS ?? 10000);
  const params = { coin: 'USDT', network: 'BSC', address, amount, timestamp, recvWindow, name: 'AutonomousSettlement' };
  return apiRequest('/sapi/v1/capital/withdraw/apply', params, 'POST');
}

async function listWithdrawals(startTime) {
  const serverTime = await getServerTime().catch(() => 0);
  const localTime = Date.now();
  const timestamp = localTime + (serverTime ? serverTime - localTime : 0);
  const recvWindow = Number(process.env.BINANCE_RECV_WINDOW_MS ?? 10000);
  const params = { coin: 'USDT', timestamp, recvWindow };
  if (startTime != null) params.startTime = Math.floor(Number(startTime));
  return apiRequest('/sapi/v1/capital/withdraw/history', params, 'GET');
}

export class CryptoGateway {
  async executeTransfer(transactions, { provider = 'binance' } = {}) {
    const enabled = String(process.env.CRYPTO_WITHDRAW_ENABLE || '').toLowerCase() === 'true';
    const network = 'BEP20';
    const prepared_at = new Date().toISOString();
    const dest = transactions[0]?.destination;
    const amount = transactions[0]?.amount;
    if (!dest || !amount) return { status: 'invalid', reason: 'missing_destination_or_amount' };
    const bitgetCreds = { apiKey: process.env.BITGET_API_KEY, secret: process.env.BITGET_API_SECRET, passphrase: process.env.BITGET_PASSPHRASE };
    const bybitCreds = { apiKey: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET };

    function mapBitgetChain(raw) {
      const v = String(raw || '').trim().toLowerCase();
      if (v === 'bep20' || v === 'bsc') return 'BSC';
      if (v === 'erc20' || v === 'eth') return 'ETH';
      if (v === 'trc20' || v === 'tron') return 'TRON';
      return raw || 'bep20';
    }

    async function bitgetRequest(method, requestPath, bodyObj, creds) {
      const base = 'api.bitget.com';
      const ts = String(Date.now());
      const body = bodyObj ? JSON.stringify(bodyObj) : '';
      const prehash = ts + method.toUpperCase() + requestPath + body;
      const sig = crypto.createHmac('sha256', String(creds.secret || '')).update(prehash).digest('base64');
      const options = {
        hostname: base,
        port: 443,
        path: requestPath,
        method,
        headers: {
          'ACCESS-KEY': String(creds.apiKey || ''),
          'ACCESS-SIGN': sig,
          'ACCESS-PASSPHRASE': String(creds.passphrase || ''),
          'ACCESS-TIMESTAMP': ts,
          'locale': 'en-US',
          'Content-Type': 'application/json'
        }
      };
      return new Promise((resolve, reject) => {
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
        if (body) req.write(body);
        req.end();
      });
    }

    if (provider === 'binance') {
      if (!enabled) {
        return { status: 'prepared', provider, network, prepared_at, transactions };
      }
      const r = await withdrawUSDTBEP20(dest, amount);
      const applyId = r.id || r.applyId || null;
      let txId = null;
      const startTime = Date.now() - 60 * 60 * 1000;
      for (let i = 0; i < 3 && !txId; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        try {
          const hist = await listWithdrawals(startTime);
          if (Array.isArray(hist)) {
            const m = hist.find((h) => String(h.address || '').toLowerCase() === String(dest).toLowerCase() && Number(h.amount) === Number(amount));
            if (m && m.txId) txId = m.txId;
          }
        } catch {}
      }
      if (!txId) return { status: 'submitted', applyId, provider, network, prepared_at };
      return { status: 'submitted_with_tx', applyId, txHash: txId, provider, network, prepared_at };
    }

    if (provider === 'bybit') {
      const outDir = 'settlements/crypto';
      const filename = `bybit_instruction_${Date.now()}.json`;
      const filePath = path.join(process.cwd(), outDir, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ provider: 'bybit', action: 'withdraw', coin: 'USDT', network: 'ERC20', address: dest, amount, status: 'WAITING_MANUAL_EXECUTION', creds_present: !!(bybitCreds.apiKey && bybitCreds.secret), origin: 'in_house' }, null, 2)
      );
      return { status: 'INSTRUCTIONS_READY', provider: 'bybit', filePath, network: 'ERC20', prepared_at, creds_present: !!(bybitCreds.apiKey && bybitCreds.secret) };
    }

    if (provider === 'bitget') {
      const hasCreds = !!(bitgetCreds.apiKey && bitgetCreds.secret && bitgetCreds.passphrase);
      const preferredRaw = String(process.env.BITGET_CHAIN || 'bep20');
      const preferredChainApi = mapBitgetChain(preferredRaw);
      const preferredNetworkLabel = (preferredChainApi === 'BSC' ? 'BEP20' : preferredChainApi).toUpperCase();
      if (enabled && hasCreds) {
        const tryChains = Array.from(new Set([preferredChainApi, 'BSC', 'ETH', 'TRON']));
        for (const chain of tryChains) {
          const label = (chain === 'BSC' ? 'BEP20' : chain).toUpperCase();
          const payloadV2 = { coin: 'USDT', transferType: 'on_chain', address: dest, chain, size: String(amount) };
          try {
            const r2 = await bitgetRequest('POST', '/api/v2/spot/wallet/withdrawal', payloadV2, bitgetCreds);
            if (r2 && r2.code === '00000') {
              return { status: 'submitted', provider: 'bitget', network: label, prepared_at, applyId: r2?.data?.orderId || null };
            }
          } catch {}
          const payloadV1 = { coin: 'USDT', address: dest, chain, amount: String(amount) };
          try {
            const r1 = await bitgetRequest('POST', '/api/spot/v1/wallet/withdrawal', payloadV1, bitgetCreds);
            if (r1 && r1.code === '00000') {
              return { status: 'submitted', provider: 'bitget', network: label, prepared_at, applyId: r1?.data?.orderId || null };
            }
          } catch {}
        }
      }
      const outDir = 'settlements/crypto';
      const filename = `bitget_instruction_${Date.now()}.json`;
      const filePath = path.join(process.cwd(), outDir, filename);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify({ provider: 'bitget', action: 'withdraw', coin: 'USDT', network: preferredNetworkLabel, address: dest, amount, status: 'WAITING_MANUAL_EXECUTION', creds_present: hasCreds, origin: 'in_house' }, null, 2)
      );
      return { status: 'INSTRUCTIONS_READY', provider: 'bitget', filePath, network: preferredNetworkLabel, prepared_at, creds_present: hasCreds };
    }

    if (provider === 'trust') {
      return { status: 'QUEUED', provider: 'trust', reason: 'NO_PRIVATE_KEYS_ALLOWED', network, prepared_at };
    }

    return { status: 'UNKNOWN_PROVIDER', provider, network, prepared_at };
  }
  
  async getWithdrawalStatus({ provider = 'binance', address, amount, startTime } = {}) {
    if (provider === 'binance') {
      try {
        const hist = await listWithdrawals(startTime ?? Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (!Array.isArray(hist)) return { status: 'unknown', provider };
        const m = hist.find((h) => String(h.address || '').toLowerCase() === String(address || '').toLowerCase() && (amount == null || Number(h.amount) === Number(amount)));
        if (!m) return { status: 'not_found', provider };
        return {
          status: String(m.status || '').toLowerCase() || 'unknown',
          txId: m.txId || null,
          id: m.id || m.applyId || null,
          coin: m.coin || 'USDT',
          network: m.network || 'BEP20'
        };
      } catch (e) {
        return { status: 'error', error: e?.message || String(e), provider };
      }
    }
    return { status: 'unsupported_provider', provider };
  }
}
