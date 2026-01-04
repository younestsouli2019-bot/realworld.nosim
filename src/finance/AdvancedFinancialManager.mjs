import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// SHARED UTILITIES & STORAGE
// ============================================================================

class FinancialStorage {
  constructor(baseDir = './data/finance') {
    this.baseDir = baseDir;
    ['events', 'payouts', 'recipients', 'goals', 'rates', 'reconciliation'].forEach(dir => {
      const fullPath = path.join(this.baseDir, dir);
      if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
    });
  }

  save(type, id, data) {
    const filepath = path.join(this.baseDir, type, `${id}.json`);
    const record = { ...data, updated_at: new Date().toISOString() };
    fs.writeFileSync(filepath, JSON.stringify(record, null, 2));
    return record;
  }

  load(type, id) {
    const filepath = path.join(this.baseDir, type, `${id}.json`);
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  }

  list(type) {
    const dir = path.join(this.baseDir, type);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
}

// ============================================================================
// 1. RECIPIENT MANAGEMENT
// ============================================================================

class RecipientManager {
  constructor(storage) {
    this.storage = storage;
  }

  createRecipient(data) {
    const id = `RCP_${crypto.randomUUID()}`;
    const recipient = {
      id,
      name: data.name,
      email: data.email,
      type: data.type || 'individual', // individual, business
      tax_id: data.tax_id,
      payment_methods: data.payment_methods || [], // [{ type: 'paypal', details: ... }]
      created_at: new Date().toISOString(),
      status: 'active'
    };
    return this.storage.save('recipients', id, recipient);
  }

  getRecipient(id) {
    return this.storage.load('recipients', id);
  }

  updateRecipient(id, updates) {
    const recipient = this.getRecipient(id);
    if (!recipient) throw new Error(`Recipient ${id} not found`);
    const updated = { ...recipient, ...updates };
    return this.storage.save('recipients', id, updated);
  }
}

// ============================================================================
// 2. MULTI-CURRENCY SUPPORT
// ============================================================================

class CurrencyManager {
  constructor(storage) {
    this.storage = storage;
    this.baseCurrency = 'USD';
    this.rates = { 'USD': 1.0 }; // Cache
  }

  async updateExchangeRates() {
    // Mock API call - in production, fetch from OpenExchangeRates or similar
    console.log('🔄 Fetching real-time exchange rates...');
    const mockRates = {
      'USD': 1.0,
      'EUR': 0.92,
      'GBP': 0.79,
      'MAD': 10.15,
      'BTC': 0.000023,
      'ETH': 0.00035
    };
    this.rates = mockRates;
    this.storage.save('rates', 'latest', { 
      base: this.baseCurrency, 
      rates: this.rates, 
      timestamp: Date.now() 
    });
    return this.rates;
  }

  getExchangeRate(from, to) {
    const fromRate = this.rates[from];
    const toRate = this.rates[to];
    if (!fromRate || !toRate) throw new Error(`Exchange rate not found for ${from} -> ${to}`);
    return toRate / fromRate;
  }

  convert(amount, from, to) {
    const rate = this.getExchangeRate(from, to);
    return amount * rate;
  }
}

// ============================================================================
// 3. REVENUE INGESTION & ADJUSTMENT
// ============================================================================

class RevenueManager {
  constructor(storage) {
    this.storage = storage;
  }

  ingestRawRevenue(data, sourceSystem) {
    const id = `REV_${crypto.randomUUID()}`;
    // Canonicalize data
    const event = {
      id,
      source_system: sourceSystem,
      original_data: data,
      amount: parseFloat(data.amount),
      currency: data.currency || 'USD',
      status: 'pending_reconciliation', // pending_reconciliation, verified, disputed, settled
      timestamp: data.timestamp || new Date().toISOString(),
      metadata: data.metadata || {}
    };
    
    // Auto-verify if proof is present (integration with existing logic)
    if (data.proof_id || data.transaction_id) {
      event.status = 'verified';
    }

    return this.storage.save('events', id, event);
  }

  disputeEvent(id, reason) {
    const event = this.storage.load('events', id);
    if (!event) throw new Error(`Event ${id} not found`);
    
    event.status = 'disputed';
    event.dispute_reason = reason;
    event.dispute_date = new Date().toISOString();
    
    return this.storage.save('events', id, event);
  }

  adjustEvent(id, newAmount, reason) {
    const event = this.storage.load('events', id);
    if (!event) throw new Error(`Event ${id} not found`);

    const oldAmount = event.amount;
    event.amount = newAmount;
    event.adjustment_history = event.adjustment_history || [];
    event.adjustment_history.push({
      date: new Date().toISOString(),
      old_amount: oldAmount,
      new_amount: newAmount,
      reason
    });
    event.status = 'adjusted';

    return this.storage.save('events', id, event);
  }
}

// ============================================================================
// 4. FINANCIAL GOALS & ANALYTICS
// ============================================================================

class FinancialGoalManager {
  constructor(storage, revenueManager) {
    this.storage = storage;
    this.revenueManager = revenueManager;
  }

  createGoal(name, targetAmount, targetDate, type = 'revenue') {
    const id = `GOAL_${crypto.randomUUID()}`;
    const goal = {
      id,
      name,
      target_amount: targetAmount,
      target_date: targetDate,
      type, // revenue, profit, liquidity
      status: 'active',
      created_at: new Date().toISOString()
    };
    return this.storage.save('goals', id, goal);
  }

  checkGoals() {
    const goals = this.storage.list('goals').filter(g => g.status === 'active');
    const events = this.storage.list('events'); // In prod, optimize this query
    
    const results = goals.map(goal => {
      let currentAmount = 0;
      
      if (goal.type === 'revenue') {
        // Sum verified revenue
        currentAmount = events
          .filter(e => e.status === 'verified' || e.status === 'settled')
          .reduce((sum, e) => sum + e.amount, 0); // Assuming USD base for simplicity
      }
      
      const progress = (currentAmount / goal.target_amount) * 100;
      const isMet = currentAmount >= goal.target_amount;
      
      return {
        goal_id: goal.id,
        name: goal.name,
        current: currentAmount,
        target: goal.target_amount,
        progress: progress.toFixed(2) + '%',
        met: isMet
      };
    });
    
    return results;
  }

  generateForecast(months = 3) {
    // Simple linear regression forecast
    const events = this.storage.list('events')
      .filter(e => e.status === 'verified' || e.status === 'settled')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (events.length < 2) return { error: "Not enough data for forecast" };

    // Calculate average daily revenue
    const firstDate = new Date(events[0].timestamp);
    const lastDate = new Date(events[events.length - 1].timestamp);
    const days = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    const totalRevenue = events.reduce((sum, e) => sum + e.amount, 0);
    const dailyAvg = totalRevenue / (days || 1);

    const forecast = [];
    let currentDate = new Date();
    
    for (let i = 1; i <= months; i++) {
      currentDate.setMonth(currentDate.getMonth() + 1);
      forecast.push({
        month: currentDate.toISOString().slice(0, 7), // YYYY-MM
        projected_revenue: (dailyAvg * 30).toFixed(2)
      });
    }

    return forecast;
  }
}

// ============================================================================
// 5. ADVANCED RECONCILIATION
// ============================================================================

class ReconciliationEngine {
  constructor(storage, revenueManager) {
    this.storage = storage;
    this.revenueManager = revenueManager;
  }

  importExternalStatement(fileData, source) {
    // Mock parsing - assumes CSV string
    const lines = fileData.trim().split('\n');
    const transactions = lines.slice(1).map(line => {
      const [date, desc, amount, currency, ref] = line.split(',');
      return { date, desc, amount: parseFloat(amount), currency, ref };
    });

    return this.matchTransactions(transactions, source);
  }

  matchTransactions(externalTxns, source) {
    const internalEvents = this.storage.list('events').filter(e => e.status !== 'reconciled');
    const matches = [];
    const unmatched = [];

    externalTxns.forEach(ext => {
      // Logic: Match by Reference ID or Amount + Date proximity
      const match = internalEvents.find(int => {
        const amountMatch = Math.abs(int.amount - ext.amount) < 0.01;
        const refMatch = int.id === ext.ref || (int.original_data && int.original_data.transaction_id === ext.ref);
        return refMatch || amountMatch; // Simplified matching logic
      });

      if (match) {
        match.status = 'reconciled';
        match.reconciliation_data = {
          source,
          external_ref: ext.ref,
          matched_at: new Date().toISOString()
        };
        this.storage.save('events', match.id, match);
        matches.push({ internal: match.id, external: ext });
      } else {
        unmatched.push(ext);
      }
    });

    return { matches, unmatched };
  }
}

// ============================================================================
// 6. RECURRING PAYOUTS
// ============================================================================

class RecurringPayoutManager {
  constructor(storage, revenueManager) {
    this.storage = storage;
    this.revenueManager = revenueManager;
  }

  createSchedule(recipientId, amount, currency, frequency, startDate) {
    const id = `SCHED_${crypto.randomUUID()}`;
    const schedule = {
      id,
      recipient_id: recipientId,
      amount,
      currency,
      frequency, // 'daily', 'weekly', 'monthly'
      start_date: startDate,
      next_run: startDate,
      status: 'active',
      created_at: new Date().toISOString()
    };
    return this.storage.save('payouts', id, schedule); // Saving in payouts dir for now
  }

  processSchedules() {
    const schedules = this.storage.list('payouts').filter(s => s.status === 'active' && s.next_run);
    const now = new Date();
    const generatedEvents = [];

    schedules.forEach(sched => {
      if (new Date(sched.next_run) <= now) {
        // Generate Revenue Event (or Payout Request)
        const event = this.revenueManager.ingestRawRevenue({
          amount: sched.amount,
          currency: sched.currency,
          source: 'RecurringSchedule',
          metadata: { schedule_id: sched.id, recipient_id: sched.recipient_id }
        }, 'RecurringPayoutSystem');
        
        generatedEvents.push(event);

        // Update next run
        const nextDate = new Date(sched.next_run);
        if (sched.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        if (sched.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (sched.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        
        sched.next_run = nextDate.toISOString();
        this.storage.save('payouts', sched.id, sched);
      }
    });

    return generatedEvents;
  }
}

// ============================================================================
// MAIN MANAGER
// ============================================================================

export class AdvancedFinancialManager {
  constructor() {
    this.storage = new FinancialStorage();
    this.recipients = new RecipientManager(this.storage);
    this.currency = new CurrencyManager(this.storage);
    this.revenue = new RevenueManager(this.storage);
    this.goals = new FinancialGoalManager(this.storage, this.revenue);
    this.reconciliation = new ReconciliationEngine(this.storage, this.revenue);
    this.recurring = new RecurringPayoutManager(this.storage, this.revenue);
  }

  async initialize() {
    console.log('🚀 Initializing Advanced Financial Manager...');
    await this.currency.updateExchangeRates();
    console.log('✅ Financial Manager Ready');
  }
}
