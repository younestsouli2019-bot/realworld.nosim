// src/financial/SettlementLedger.mjs
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'financial', 'settlement_ledger.json');

export class SettlementLedger {
  constructor() {
    this.ensureLedgerExists();
  }

  ensureLedgerExists() {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LEDGER_PATH)) {
      fs.writeFileSync(LEDGER_PATH, JSON.stringify({
        daily_usage: {}, // { "YYYY-MM-DD": { "BANK_WIRE": 0, ... } }
        transactions: [], // History of all transactions
        queued: [] // Transactions waiting for limits/resources
      }, null, 2));
    }
  }

  getLedger() {
    try {
      return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    } catch (e) {
      return { daily_usage: {}, transactions: [], queued: [] };
    }
  }

  saveLedger(data) {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2));
  }

  getDailyUsage(channel) {
    const data = this.getLedger();
    const today = new Date().toISOString().split('T')[0];
    
    if (!data.daily_usage[today]) {
      return 0;
    }
    return data.daily_usage[today][channel] || 0;
  }

  recordTransaction(channel, amount, status, txId, details = {}) {
    const data = this.getLedger();
    const today = new Date().toISOString().split('T')[0];

    // Update Daily Usage if Completed
    if (status === 'COMPLETED' || status === 'IN_TRANSIT') {
      if (!data.daily_usage[today]) data.daily_usage[today] = {};
      if (!data.daily_usage[today][channel]) data.daily_usage[today][channel] = 0;
      data.daily_usage[today][channel] += amount;
    }

    // Record Transaction
    const transaction = {
      id: txId || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      channel,
      amount,
      status, // QUEUED, IN_TRANSIT, COMPLETED, FAILED
      details
    };
    
    data.transactions.push(transaction);
    this.saveLedger(data);
    return transaction;
  }

  queueTransaction(channel, amount, reason) {
    const data = this.getLedger();
    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      channel,
      amount,
      reason,
      status: 'QUEUED'
    };
    data.queued.push(queueItem);
    this.saveLedger(data);
    return queueItem;
  }
}
