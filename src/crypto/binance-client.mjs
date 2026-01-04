import crypto from 'node:crypto';

export class BinanceClient {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY;
    this.apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY;
    this.baseUrl = 'https://api.binance.com';
    this.serverTimeOffsetMs = 0;
    
    if (!this.apiKey || !this.apiSecret) {
      console.warn("⚠️ Binance API keys missing. Crypto rail will be limited.");
    }
  }

  async syncServerTime() {
    try {
      const res = await fetch(`${this.baseUrl}/api/v3/time`);
      const j = await res.json();
      const serverTime = Number(j.serverTime || 0);
      if (Number.isFinite(serverTime) && serverTime > 0) {
        this.serverTimeOffsetMs = Date.now() - serverTime;
      }
    } catch {}
  }
 
  async _request(endpoint, method = 'GET', params = {}) {
    if (!this.apiKey || !this.apiSecret) throw new Error("Binance keys missing");

    if (!this.serverTimeOffsetMs) {
      await this.syncServerTime();
    }
    const timestamp = Date.now() - this.serverTimeOffsetMs;
    const recvWindow = Number(process.env.BINANCE_RECV_WINDOW_MS ?? 10000);
    const baseParams = { ...params, timestamp, recvWindow };
    const sorted = Object.keys(baseParams)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, baseParams[k]]);
    const qs = new URLSearchParams();
    for (const [k, v] of sorted) qs.append(k, String(v));
    const queryString = qs.toString();
    const signature = crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');

    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'X-MBX-APIKEY': this.apiKey
        }
      });
      
      if (!res.ok) {
        const errText = await res.text();
        if (errText && errText.includes('-1021')) {
          await this.syncServerTime();
          return this._request(endpoint, method, params);
        }
        throw new Error(`Binance API Error: ${errText}`);
      }
      
      return await res.json();
    } catch (error) {
      console.error(`Binance Request Failed: ${error.message}`);
      throw error;
    }
  }

  async getAccountInfo() {
    return this._request('/api/v3/account');
  }

  async getDepositAddress(coin = 'USDT', network = 'ETH') {
    // Note: SAPI endpoint for capital/deposit/address
    // This often requires specific permissions
    return this._request('/sapi/v1/capital/deposit/address', 'GET', { coin, network });
  }
  
  async getDepositHistory(coin = 'USDT', startTime = undefined, endTime = undefined) {
    const params = { coin };
    if (startTime != null) params.startTime = Math.floor(Number(startTime));
    if (endTime != null) params.endTime = Math.floor(Number(endTime));
    return this._request('/sapi/v1/capital/deposit/hisrec', 'GET', params);
  }
  
  getEnvDepositAddress(coin = 'USDT', network = 'TRX') {
    const net = String(network || '').toUpperCase();
    if (coin !== 'USDT') return null;
    if (net === 'TRX' || net === 'TRC20') {
      const address = process.env.CRYPTO_USDT_TRX_ADDRESS || null;
      const tag = process.env.CRYPTO_USDT_TRX_TAG || null;
      if (address) return { address, tag, coin: 'USDT', network: 'TRX' };
      return null;
    }
    if (net === 'BSC' || net === 'BEP20') {
      const address = process.env.CRYPTO_USDT_BEP20_ADDRESS || null;
      const tag = process.env.CRYPTO_USDT_BEP20_TAG || null;
      if (address) return { address, tag, coin: 'USDT', network: 'BSC' };
      return null;
    }
    if (net === 'ETH' || net === 'ERC20') {
      const address = process.env.CRYPTO_USDT_ERC20_ADDRESS || null;
      const tag = process.env.CRYPTO_USDT_ERC20_TAG || null;
      if (address) return { address, tag, coin: 'USDT', network: 'ETH' };
      return null;
    }
    return null;
  }
  
  async isReady() {
      return !!(this.apiKey && this.apiSecret);
  }
}

export const binanceClient = new BinanceClient();
