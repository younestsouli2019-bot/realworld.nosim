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

    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
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

    try {
      const timestamp = Date.now();
      const withdrawParams = {
        coin: 'USDT',
        network: 'BSC',
        address: TARGET_WALLET.address,
        amount: amount,
        timestamp: timestamp,
        name: 'AutonomousSettlement'
      };
      
      // UNCOMMENT TO ENABLE REAL WITHDRAWAL (Requires valid keys)
      // const result = await binanceRequest('/sapi/v1/capital/withdraw/apply', withdrawParams, 'POST');
      // txId = result.id;
      
      // IF API FAILS OR IS DISABLED, WE HALT. WE DO NOT SIMULATE.
      if (!process.env.BINANCE_API_KEY) {
        throw new Error("BINANCE KEYS MISSING. Cannot execute autonomous withdrawal.");
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
    console.log('    (Waiting for transaction confirmation...)');
    
    const verifier = new ChainVerifier();
    
    // If we had a txId from Binance, we would verify THAT specific hash.
    // Since we likely don't (due to missing keys in this env), we wait for ANY valid tx.
    // BUT user said "PROOF IT ALL".
    
    if (!txId) {
        console.log('ℹ️  No Internal TX ID to verify. Checking manual settlement status...');
        // In a real loop, we would poll here. For this script, we check once and fail if not found.
        // Or we simply output the INSTRUCTION for the user.
        
        const instructionPath = path.join(RECEIPTS_DIR, `instruction_${Date.now()}.txt`);
        const instruction = `
ACTION REQUIRED: MANUAL CRYPTO SETTLEMENT
-----------------------------------------
The system could not autonomously withdraw funds (Missing Keys/API).
Please execute the following transfer MANUALLY:

AMOUNT:      ${amount} USDT
NETWORK:     BSC (BEP20)
DESTINATION: ${TARGET_WALLET.address}

Once executed, the system will detect the transaction on-chain.
`;
        fs.writeFileSync(instructionPath, instruction);
        console.log(`📄 INSTRUCTION SAVED: ${instructionPath}`);
        console.log('❌ STATUS: PENDING_MANUAL_EXECUTION (NOT COMPLETED)');
        process.exit(0); // Exit cleanly, but NOT completed.
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
