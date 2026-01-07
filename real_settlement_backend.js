// ============================================================================
// REAL SETTLEMENT BACKEND - PRODUCTION READY
// ============================================================================
// 
// Ce backend exécute VRAIMENT les settlements - pas de simulation
// 
// SETUP:
// 1. npm install express ccxt @paypal/payouts-sdk stripe better-sqlite3 dotenv node-cron
// 2. Créer .env avec tes vraies credentials
// 3. node server.js
//
// ============================================================================

require('dotenv').config();
const express = require('express');
const ccxt = require('ccxt');
const paypal = require('@paypal/payouts-sdk');
const Stripe = require('stripe');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ============================================================================
// DATABASE SETUP
// ============================================================================

const db = new Database('settlements.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL,
    tx_id TEXT,
    batch_id TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    confirmed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS balances (
    provider TEXT PRIMARY KEY,
    balance REAL NOT NULL,
    currency TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    provider TEXT,
    amount REAL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================================================
// PAYMENT PROVIDER CONFIGURATIONS
// ============================================================================

// PayPal Configuration
const paypalEnvironment = process.env.PAYPAL_MODE === 'live' 
  ? new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    )
  : new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );

const paypalClient = new paypal.core.PayPalHttpClient(paypalEnvironment);

// Stripe Configuration
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Bitget Configuration
const bitget = new ccxt.bitget({
  apiKey: process.env.BITGET_API_KEY,
  secret: process.env.BITGET_SECRET,
  password: process.env.BITGET_PASSWORD,
  enableRateLimit: true
});

// Bybit Configuration
const bybit = new ccxt.bybit({
  apiKey: process.env.BYBIT_API_KEY,
  secret: process.env.BYBIT_SECRET,
  enableRateLimit: true
});

// Owner Accounts
const OWNER_ACCOUNTS = {
  paypal: process.env.OWNER_PAYPAL_EMAIL || 'younestsouli2019@gmail.com',
  bank_rib: process.env.OWNER_BANK_RIB || '007810000448500030594182',
  crypto_wallet: process.env.OWNER_CRYPTO_WALLET || '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7',
  payoneer: process.env.OWNER_PAYONEER_ID || 'younestsouli2019@gmail.com'
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

function auditLog(action, provider, amount, details) {
  const stmt = db.prepare(`
    INSERT INTO audit_log (action, provider, amount, details)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(action, provider, amount, JSON.stringify(details));
  
  console.log(`[AUDIT] ${action} - ${provider} - ${amount || 'N/A'}`);
}

// ============================================================================
// BALANCE CHECK FUNCTIONS
// ============================================================================

async function checkPayPalBalance() {
  try {
    const request = new paypal.core.PayPalHttpRequest('/v1/reporting/balances');
    request.verb('GET');
    const response = await paypalClient.execute(request);
    
    const balance = response.result.balances.find(b => b.currency === 'USD');
    const available = parseFloat(balance?.available_balance?.value || 0);
    
    db.prepare('INSERT OR REPLACE INTO balances (provider, balance, currency, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run('paypal', available, 'USD');
    
    auditLog('BALANCE_CHECK', 'paypal', available, { currency: 'USD' });
    return available;
  } catch (error) {
    console.error('PayPal balance check failed:', error.message);
    return 0;
  }
}

async function checkBitgetBalance(coin = 'USDT') {
  try {
    const balance = await bitget.fetchBalance();
    const available = balance[coin]?.free || 0;
    
    db.prepare('INSERT OR REPLACE INTO balances (provider, balance, currency, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run('bitget', available, coin);
    
    auditLog('BALANCE_CHECK', 'bitget', available, { currency: coin });
    return available;
  } catch (error) {
    console.error('Bitget balance check failed:', error.message);
    return 0;
  }
}

async function checkBybitBalance(coin = 'USDT') {
  try {
    const balance = await bybit.fetchBalance();
    const available = balance[coin]?.free || 0;
    
    db.prepare('INSERT OR REPLACE INTO balances (provider, balance, currency, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run('bybit', available, coin);
    
    auditLog('BALANCE_CHECK', 'bybit', available, { currency: coin });
    return available;
  } catch (error) {
    console.error('Bybit balance check failed:', error.message);
    return 0;
  }
}

async function checkStripeBalance() {
  try {
    const balance = await stripe.balance.retrieve();
    const available = balance.available[0]?.amount / 100 || 0; // Convert cents to dollars
    
    db.prepare('INSERT OR REPLACE INTO balances (provider, balance, currency, last_updated) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run('stripe', available, 'USD');
    
    auditLog('BALANCE_CHECK', 'stripe', available, { currency: 'USD' });
    return available;
  } catch (error) {
    console.error('Stripe balance check failed:', error.message);
    return 0;
  }
}

// ============================================================================
// SETTLEMENT EXECUTION FUNCTIONS
// ============================================================================

async function executePayPalPayout(amount) {
  try {
    const batchId = `BATCH_PP_${Date.now()}`;
    
    const request = new paypal.payouts.PayoutsPostRequest();
    request.requestBody({
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: "Settlement Payment",
        email_message: "You have received a settlement payment."
      },
      items: [{
        recipient_type: "EMAIL",
        amount: {
          value: amount.toFixed(2),
          currency: "USD"
        },
        receiver: OWNER_ACCOUNTS.paypal,
        sender_item_id: `ITEM_${Date.now()}`
      }]
    });

    const response = await paypalClient.execute(request);
    const payoutBatchId = response.result.batch_header.payout_batch_id;
    
    // Save to database
    const stmt = db.prepare(`
      INSERT INTO settlements (provider, type, amount, currency, destination, status, batch_id, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run('paypal', 'payout', amount, 'USD', OWNER_ACCOUNTS.paypal, 'processing', payoutBatchId);
    
    auditLog('PAYOUT_EXECUTED', 'paypal', amount, { 
      batch_id: payoutBatchId,
      destination: OWNER_ACCOUNTS.paypal 
    });
    
    return { success: true, batch_id: payoutBatchId };
  } catch (error) {
    auditLog('PAYOUT_FAILED', 'paypal', amount, { error: error.message });
    throw error;
  }
}

async function executeBitgetWithdrawal(amount, coin = 'USDT', network = 'BEP20') {
  try {
    // Get withdrawal fee
    const fees = await bitget.fetchDepositWithdrawFees([coin]);
    const fee = fees[coin]?.withdraw?.fee || 0;
    
    // Execute withdrawal
    const withdrawal = await bitget.withdraw(coin, amount, OWNER_ACCOUNTS.crypto_wallet, {
      network: network
    });
    
    // Save to database
    const stmt = db.prepare(`
      INSERT INTO settlements (provider, type, amount, currency, destination, status, tx_id, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run('bitget', 'withdrawal', amount, coin, OWNER_ACCOUNTS.crypto_wallet, 'pending', withdrawal.id);
    
    auditLog('WITHDRAWAL_EXECUTED', 'bitget', amount, {
      coin,
      network,
      tx_id: withdrawal.id,
      destination: OWNER_ACCOUNTS.crypto_wallet
    });
    
    return { success: true, tx_id: withdrawal.id, fee };
  } catch (error) {
    auditLog('WITHDRAWAL_FAILED', 'bitget', amount, { error: error.message });
    throw error;
  }
}

async function executeBybitWithdrawal(amount, coin = 'USDT', network = 'BSC') {
  try {
    const withdrawal = await bybit.withdraw(coin, amount, OWNER_ACCOUNTS.crypto_wallet, {
      chain: network
    });
    
    const stmt = db.prepare(`
      INSERT INTO settlements (provider, type, amount, currency, destination, status, tx_id, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run('bybit', 'withdrawal', amount, coin, OWNER_ACCOUNTS.crypto_wallet, 'pending', withdrawal.id);
    
    auditLog('WITHDRAWAL_EXECUTED', 'bybit', amount, {
      coin,
      network,
      tx_id: withdrawal.id,
      destination: OWNER_ACCOUNTS.crypto_wallet
    });
    
    return { success: true, tx_id: withdrawal.id };
  } catch (error) {
    auditLog('WITHDRAWAL_FAILED', 'bybit', amount, { error: error.message });
    throw error;
  }
}

async function executeStripePayout(amount) {
  try {
    // Stripe requires a connected account or bank account to be set up
    // This is a simplified version - you'll need to configure your bank account first
    
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: 'Settlement payout',
      method: 'standard' // or 'instant' for faster transfer
    });
    
    const stmt = db.prepare(`
      INSERT INTO settlements (provider, type, amount, currency, destination, status, tx_id, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run('stripe', 'payout', amount, 'USD', OWNER_ACCOUNTS.bank_rib, 'processing', payout.id);
    
    auditLog('PAYOUT_EXECUTED', 'stripe', amount, {
      payout_id: payout.id,
      arrival_date: payout.arrival_date
    });
    
    return { success: true, payout_id: payout.id };
  } catch (error) {
    auditLog('PAYOUT_FAILED', 'stripe', amount, { error: error.message });
    throw error;
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    owner_accounts: OWNER_ACCOUNTS
  });
});

// Get all balances
app.get('/api/balances', async (req, res) => {
  try {
    const balances = db.prepare('SELECT * FROM balances').all();
    res.json({ success: true, balances });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check balances (force refresh)
app.post('/api/balances/check', async (req, res) => {
  try {
    const results = await Promise.allSettled([
      checkPayPalBalance(),
      checkBitgetBalance('USDT'),
      checkBybitBalance('USDT'),
      checkStripeBalance()
    ]);
    
    const balances = db.prepare('SELECT * FROM balances').all();
    res.json({ success: true, balances, checks: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute PayPal payout
app.post('/api/payout/paypal', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    const result = await executePayPalPayout(amount);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Bitget withdrawal
app.post('/api/withdraw/bitget', async (req, res) => {
  try {
    const { amount, coin = 'USDT', network = 'BEP20' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    const result = await executeBitgetWithdrawal(amount, coin, network);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Bybit withdrawal
app.post('/api/withdraw/bybit', async (req, res) => {
  try {
    const { amount, coin = 'USDT', network = 'BSC' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    const result = await executeBybitWithdrawal(amount, coin, network);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Stripe payout
app.post('/api/payout/stripe', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    const result = await executeStripePayout(amount);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get settlement history
app.get('/api/settlements', (req, res) => {
  try {
    const { provider, status, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM settlements WHERE 1=1';
    const params = [];
    
    if (provider) {
      query += ' AND provider = ?';
      params.push(provider);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const settlements = db.prepare(query).all(...params);
    res.json({ success: true, settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get audit log
app.get('/api/audit', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?').all(parseInt(limit));
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger auto-settlement for all providers
app.post('/api/settle/auto', async (req, res) => {
  try {
    const results = await autoSettleAll();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// AUTO-SETTLEMENT DAEMON
// ============================================================================

async function autoSettleAll() {
  console.log('\n🤖 AUTO-SETTLEMENT CYCLE STARTED');
  console.log('═'.repeat(60));
  
  const results = {
    paypal: null,
    bitget: null,
    bybit: null,
    stripe: null
  };
  
  // PayPal
  try {
    const balance = await checkPayPalBalance();
    if (balance > 100) {
      console.log(`💰 PayPal: $${balance} available - executing payout...`);
      results.paypal = await executePayPalPayout(balance);
      console.log(`✅ PayPal payout executed: ${results.paypal.batch_id}`);
    } else {
      console.log(`⏭️  PayPal: $${balance} - below threshold`);
    }
  } catch (error) {
    console.error(`❌ PayPal failed: ${error.message}`);
    results.paypal = { error: error.message };
  }
  
  // Bitget
  try {
    const balance = await checkBitgetBalance('USDT');
    if (balance > 50) {
      console.log(`💰 Bitget: ${balance} USDT available - executing withdrawal...`);
      results.bitget = await executeBitgetWithdrawal(balance, 'USDT', 'BEP20');
      console.log(`✅ Bitget withdrawal executed: ${results.bitget.tx_id}`);
    } else {
      console.log(`⏭️  Bitget: ${balance} USDT - below threshold`);
    }
  } catch (error) {
    console.error(`❌ Bitget failed: ${error.message}`);
    results.bitget = { error: error.message };
  }
  
  // Bybit
  try {
    const balance = await checkBybitBalance('USDT');
    if (balance > 50) {
      console.log(`💰 Bybit: ${balance} USDT available - executing withdrawal...`);
      results.bybit = await executeBybitWithdrawal(balance, 'USDT', 'BSC');
      console.log(`✅ Bybit withdrawal executed: ${results.bybit.tx_id}`);
    } else {
      console.log(`⏭️  Bybit: ${balance} USDT - below threshold`);
    }
  } catch (error) {
    console.error(`❌ Bybit failed: ${error.message}`);
    results.bybit = { error: error.message };
  }
  
  // Stripe
  try {
    const balance = await checkStripeBalance();
    if (balance > 100) {
      console.log(`💰 Stripe: $${balance} available - executing payout...`);
      results.stripe = await executeStripePayout(balance);
      console.log(`✅ Stripe payout executed: ${results.stripe.payout_id}`);
    } else {
      console.log(`⏭️  Stripe: $${balance} - below threshold`);
    }
  } catch (error) {
    console.error(`❌ Stripe failed: ${error.message}`);
    results.stripe = { error: error.message };
  }
  
  console.log('═'.repeat(60));
  console.log('✅ AUTO-SETTLEMENT CYCLE COMPLETED\n');
  
  return results;
}

// Schedule auto-settlement every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log(`\n⏰ [${new Date().toISOString()}] Scheduled auto-settlement triggered`);
  autoSettleAll().catch(err => {
    console.error('Auto-settlement failed:', err);
  });
});

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

// PayPal webhook
app.post('/webhooks/paypal', (req, res) => {
  const event = req.body;
  
  console.log('📥 PayPal webhook received:', event.event_type);
  
  auditLog('WEBHOOK_RECEIVED', 'paypal', null, {
    event_type: event.event_type,
    resource_id: event.resource?.id
  });
  
  // Handle specific events
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const amount = parseFloat(event.resource?.amount?.value || 0);
    console.log(`💰 Payment captured: $${amount}`);
  }
  
  res.json({ received: true });
});

// Stripe webhook
app.post('/webhooks/stripe', (req, res) => {
  const event = req.body;
  
  console.log('📥 Stripe webhook received:', event.type);
  
  auditLog('WEBHOOK_RECEIVED', 'stripe', null, {
    event_type: event.type,
    object_id: event.data?.object?.id
  });
  
  res.json({ received: true });
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('\n🚀 REAL SETTLEMENT BACKEND STARTED');
  console.log('═'.repeat(60));
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`👤 Owner accounts configured:`);
  console.log(`   PayPal: ${OWNER_ACCOUNTS.paypal}`);
  console.log(`   Bank: ${OWNER_ACCOUNTS.bank_rib}`);
  console.log(`   Crypto: ${OWNER_ACCOUNTS.crypto_wallet}`);
  console.log(`   Payoneer: ${OWNER_ACCOUNTS.payoneer}`);
  console.log('═'.repeat(60));
  console.log('⏰ Auto-settlement daemon running (every 5 minutes)');
  console.log('📊 Database: settlements.db');
  console.log('\n✅ Ready to execute real settlements\n');
  
  // Run initial balance check
  setTimeout(() => {
    console.log('🔍 Running initial balance check...\n');
    autoSettleAll().catch(console.error);
  }, 2000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  db.close();
  process.exit(0);
});