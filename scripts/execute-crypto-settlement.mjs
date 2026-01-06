import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { ChainVerifier } from '../src/verification/ChainVerifier.mjs';
import 'dotenv/config';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

const TARGET_WALLET = {
  address: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7',
  network: 'BSC', // BEP20
  coin: 'USDT'
};

const BATCH_ID = process.argv[2];
const RECEIPTS_DIR = path.resolve('exports/receipts');
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

// ------------------------------------------------------------------
// BINANCE API (REAL EXECUTION)
// ------------------------------------------------------------------

function binanceRequest(endpoint, params = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      return reject(new Error("MISSING_BINANCE_KEYS: Cannot execute withdrawal without API keys."));
    }

    const keys = Object.keys(params).sort((a, b) => a.localeCompare(b));
    const queryString = keys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    const fullQuery = `${queryString}&signature=${signature}`;
    
    const options = {
      hostname: 'api.binance.com',
      port: 443,
      path: `${endpoint}?${fullQuery}`,
      method: method,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code && json.code !== 200) { // Binance error format
             reject(new Error(`Binance Error ${json.code}: ${json.msg}`));
          } else {
             resolve(json);
          }
        } catch (e) {
          reject(new Error("Invalid JSON response from Binance"));
        }
      });
    });

    req.on('error', e => reject(e));
    req.end();
  });
}

async function getServerTime() {
  return new Promise((resolve, reject) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let data = '';
      res.on('data', c => data += c);
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

async function binanceWithdrawUSDTBep20({ address, amount, name = 'AutonomousSettlement' }) {
  const serverTime = await getServerTime().catch(() => 0);
  const localTime = Date.now();
  const offset = serverTime ? serverTime - localTime : 0;
  const timestamp = Date.now() + offset;
  const recvWindow = Number(process.env.BINANCE_RECV_WINDOW_MS ?? 10000);
  const params = {
    coin: 'USDT',
    network: 'BSC',
    address,
    amount,
    timestamp,
    name,
    recvWindow
  };
  return binanceRequest('/sapi/v1/capital/withdraw/apply', params, 'POST');
}

async function binanceListWithdrawals({ coin = 'USDT', startTime, endTime }) {
  const serverTime = await getServerTime().catch(() => 0);
  const localTime = Date.now();
  const offset = serverTime ? serverTime - localTime : 0;
  const timestamp = Date.now() + offset;
  const recvWindow = Number(process.env.BINANCE_RECV_WINDOW_MS ?? 10000);
  const params = { coin, timestamp, recvWindow };
  if (startTime != null) params.startTime = Math.floor(Number(startTime));
  if (endTime != null) params.endTime = Math.floor(Number(endTime));
  return binanceRequest('/sapi/v1/capital/withdraw/history', params, 'GET');
}

// ------------------------------------------------------------------
// MAIN EXECUTION FLOW
// ------------------------------------------------------------------

async function run() {
  console.log(`\n💰 EXECUTING AUTONOMOUS CRYPTO SETTLEMENT (BATCH: ${BATCH_ID || 'AUTO'})`);
  console.log('🔒 SECURITY MODE: PROOF-OF-SETTLEMENT (NO PRIVATE KEYS)');

  try {
    const amount = 850.00; // Fixed for this batch
    
    // 1. ATTEMPT REAL WITHDRAWAL VIA BINANCE API
    console.log('\n📡 INITIATING WITHDRAWAL VIA BINANCE API...');
    let txId = null;
    let withdrawId = null;
    const enable = String(process.env.CRYPTO_WITHDRAW_ENABLE || '').toLowerCase() === 'true';

    try {
      if (!process.env.BINANCE_API_KEY) {
        throw new Error("BINANCE KEYS MISSING. Cannot execute autonomous withdrawal.");
      }
      if (!enable) {
        throw new Error("CRYPTO_WITHDRAW_ENABLE not set to true. Refusing real fund movement.");
      }

      const result = await binanceWithdrawUSDTBep20({
        address: TARGET_WALLET.address,
        amount
      });
      withdrawId = result.id || result.applyId || null;
      console.log(`✅ Withdrawal submitted. WithdrawID: ${withdrawId ?? 'unknown'}`);

      const startTime = Date.now() - 60 * 60 * 1000;
      for (let i = 0; i < 3 && !txId; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const hist = await binanceListWithdrawals({ coin: 'USDT', startTime });
          if (Array.isArray(hist)) {
            const match = hist.find((h) => String(h.address || '').toLowerCase() === TARGET_WALLET.address.toLowerCase() && Number(h.amount) === Number(amount));
            if (match && match.txId) {
              txId = match.txId;
              console.log(`🔗 On-chain txId resolved: ${txId}`);
              break;
            }
          }
        } catch {}
      }

    } catch (e) {
      console.error(`❌ WITHDRAWAL FAILED: ${e.message}`);
      console.log('⚠️  MANUAL INTERVENTION REQUIRED.');
      console.log('    The system cannot autonomously move funds without valid Exchange Keys or a Private Key.');
      console.log('    PLEASE MANUALLY SEND FUNDS TO THE TARGET ADDRESS.');
      
      // We do NOT exit. We proceed to VERIFICATION phase to see if user did it manually.
    }

    // 2. VERIFICATION PHASE (STRICT)
    console.log('\n🔍 VERIFICATION PHASE: SCANNING BLOCKCHAIN...');
    
    const verifier = new ChainVerifier();
    
    if (!txId) {
      console.log('ℹ️  No on-chain txId available yet. Recording submission and exiting with non-zero to trigger orchestrator follow-up.');
      const receiptPath = path.join(RECEIPTS_DIR, `crypto_settlement_submitted_${Date.now()}.json`);
      const receipt = {
        timestamp: new Date().toISOString(),
        batch_id: BATCH_ID || 'AUTO-STIMULUS',
        amount: amount,
        currency: 'USDT',
        network: 'BSC',
        destination: TARGET_WALLET.address,
        withdraw_id: withdrawId,
        status: 'SUBMITTED_PENDING_CHAIN_TX',
        method: 'BINANCE_API_SUBMIT'
      };
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
      console.log(`📝 Submission recorded: ${receiptPath}`);
      process.exit(2);
    }

    // If we DID get a txId, verify it.
    await verifier.verifyTransaction(txId, amount, TARGET_WALLET.address);

    // ONLY IF VERIFIED:
    // Update Ledger
    const receiptPath = path.join(RECEIPTS_DIR, `crypto_settlement_${Date.now()}.json`);
    const receipt = {
      timestamp: new Date().toISOString(),
      batch_id: BATCH_ID || 'AUTO-STIMULUS',
      amount: amount,
      currency: 'USDT',
      network: 'BSC',
      destination: TARGET_WALLET.address,
      tx_hash: txId,
      status: 'COMPLETED_AND_VERIFIED', // STRICT STATUS
      method: 'BINANCE_API_VERIFIED'
    };

    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
    console.log(`\n✅ SETTLEMENT VERIFIED & COMPLETE`);
    console.log(`   Receipt: ${receiptPath}`);

  } catch (error) {
    console.error('\n❌ CRITICAL FAILURE:', error.message);
    process.exit(1);
  }
}

run();
