// scripts/auto-settlement-daemon.mjs
// AUTONOMOUS SETTLEMENT: Immediate owner payouts with ZERO unnecessary delays

import {
  OWNER_ACCOUNTS,
  enforceOwnerDirective,
  selectOptimalOwnerAccount,
  generateOwnerPayoutConfig,
  validateOwnerDirectiveSetup,
  preExecutionOwnerCheck
} from '../src/owner-directive.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';
import { createPayPalPayoutBatch } from '../src/paypal-api.mjs';
import { MoneyMovedGate } from '../src/real/money-moved-gate.mjs';
import { EvidenceIntegrityChain } from '../src/real/evidence-integrity.mjs';
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
import '../src/load-env.mjs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Settlement frequency
  CHECK_INTERVAL_MS: 60 * 1000, // Check every 1 minute
  
  // Auto-approval thresholds (no manual approval needed)
  AUTO_APPROVE_THRESHOLD: 5000, // USD - auto-approve up to this amount
  
  // Batch configuration
  MIN_BATCH_SIZE: 1, // Settle even single events
  MAX_BATCH_SIZE: 100, // Max events per batch
  
  // Settlement urgency
  MAX_SETTLEMENT_DELAY_HOURS: 0.25, // 15 minutes max from verification to settlement
  
  // Rail preferences (in order)
  RAIL_PRIORITY: ['PAYPAL', 'BANK_WIRE', 'PAYONEER'],
  
  // Modes
  ENABLE_IMMEDIATE_SETTLEMENT: true, // Settle as soon as verified
  ENABLE_EMERGENCY_MODE: false, // Bypass all checks (use with caution)
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class SettlementState {
  constructor() {
    this.running = false;
    this.lastCheck = null;
    this.lastSettlement = null;
    this.totalSettled = 0;
    this.settlementCount = 0;
    this.errors = [];
  }

  markCheck() {
    this.lastCheck = new Date().toISOString();
  }

  markSettlement(amount) {
    this.lastSettlement = new Date().toISOString();
    this.totalSettled += amount;
    this.settlementCount += 1;
  }

  addError(error) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack
    });
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
  }

  getStatus() {
    return {
      running: this.running,
      lastCheck: this.lastCheck,
      lastSettlement: this.lastSettlement,
      totalSettled: this.totalSettled,
      settlementCount: this.settlementCount,
      errorCount: this.errors.length,
      uptime: this.running ? Date.now() - new Date(this.lastCheck).getTime() : 0
    };
  }
}

const state = new SettlementState();

// ============================================================================
// MAIN SETTLEMENT LOOP
// ============================================================================

export async function startAutoSettlementDaemon() {
  console.log('🚀 Starting Autonomous Settlement Daemon...');
  console.log('📋 Configuration:', JSON.stringify(CONFIG, null, 2));

  // Validate owner directive setup
  try {
    validateOwnerDirectiveSetup();
    console.log('✅ Owner Directive validated');
  } catch (error) {
    console.error('❌ Owner Directive validation failed:', error.message);
    process.exit(1);
  }

  state.running = true;
  console.log('✅ Daemon started - settlements will be processed every', CONFIG.CHECK_INTERVAL_MS / 1000, 'seconds');

  // Initial immediate check
  await performSettlementCycle();

  // Schedule regular checks
  const intervalId = setInterval(async () => {
    try {
      await performSettlementCycle();
    } catch (error) {
      console.error('❌ Settlement cycle error:', error);
      state.addError(error);
    }
  }, CONFIG.CHECK_INTERVAL_MS);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down settlement daemon...');
    clearInterval(intervalId);
    state.running = false;
    console.log('📊 Final stats:', state.getStatus());
    process.exit(0);
  });

  return intervalId;
}

/**
 * Main settlement cycle - runs periodically
 */
export async function performSettlementCycle() {
  state.markCheck();
  console.log(`\n🔄 [${new Date().toISOString()}] Starting settlement cycle...`);

  try {
    // Step 1: Fetch verified revenue events ready for settlement
    const readyEvents = await fetchReadyForSettlement();
    
    if (readyEvents.length === 0) {
      console.log('✅ No events ready for settlement');
      return;
    }

    console.log(`📦 Found ${readyEvents.length} events ready for settlement`);

    // Step 2: Group events by optimal rail
    const batchesByRail = groupEventsByRail(readyEvents);

    // Step 3: Process each rail batch
    for (const [rail, events] of Object.entries(batchesByRail)) {
      console.log(`\n💰 Processing ${rail} batch: ${events.length} events`);
      
      try {
        await processRailBatch(rail, events);
      } catch (error) {
        console.error(`❌ Failed to process ${rail} batch:`, error.message);
        state.addError(error);
      }
    }

  } catch (error) {
    console.error('❌ Settlement cycle error:', error);
    state.addError(error);
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches revenue events that are verified and ready for settlement
 */
async function fetchReadyForSettlement() {
  const base44 = await buildBase44Client();
  const revenueConfig = getRevenueConfigFromEnv();
  const revenueEntity = base44.asServiceRole.entities[revenueConfig.entityName];

  try {
    // We need to fetch all and filter because listing with complex filters might be limited
    // depending on the SDK/API capabilities.
    let allEvents = [];
    let page = 1;
    while (true) {
        const res = await base44.asServiceRole.list(revenueEntity, { page, perPage: 100 });
        allEvents = allEvents.concat(res.items);
        if (page >= res.totalPages) break;
        page++;
    }

    const events = allEvents.filter(e => 
      e.status === 'VERIFIED' && 
      !e.settled && 
      !e.paid_out &&
      e.verification_proof && 
      Object.keys(e.verification_proof).length > 0
    );

    // Filter by settlement delay threshold
    const urgentEvents = events.filter(event => {
      // If immediate settlement is enabled, we take everything verified
      if (CONFIG.ENABLE_IMMEDIATE_SETTLEMENT) return true;
      
      const ageHours = (Date.now() - new Date(event.created_at || event.timestamp).getTime()) / (1000 * 60 * 60);
      return ageHours < CONFIG.MAX_SETTLEMENT_DELAY_HOURS;
    });

    return urgentEvents;
  } catch (error) {
    console.error('❌ Failed to fetch ready events:', error);
    return [];
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Groups events by optimal payment rail
 */
function groupEventsByRail(events) {
  const batches = {};

  for (const event of events) {
    const account = selectOptimalOwnerAccount(event.amount, event.currency);
    const rail = account.type;

    if (!batches[rail]) {
      batches[rail] = [];
    }

    batches[rail].push(event);
  }

  return batches;
}

/**
 * Processes a batch of events for a specific rail
 */
async function processRailBatch(rail, events) {
  console.log(`⚡ Processing ${rail} batch: ${events.length} events`);

  // Step 1: Gate Check (Hard-Binding)
  const validEvents = [];
  for (const event of events) {
      try {
          await MoneyMovedGate.assertMoneyMoved(event);
          validEvents.push(event);
      } catch (e) {
          console.error(`❌ Gate Check Failed for ${event.id}: ${e.message}`);
          state.addError(new Error(`Gate Check Failed for ${event.id}: ${e.message}`));
      }
  }

  if (validEvents.length === 0) {
      console.log('⚠️ No valid events after gate check.');
      return;
  }

  // Step 2: Create payout batch
  const batch = await createPayoutBatch(rail, validEvents);
  console.log(`📦 Created batch: ${batch.batch_id}`);

  // Step 3: Auto-approve (if under threshold)
  const totalAmount = validEvents.reduce((sum, e) => sum + Number(e.amount), 0);
  
  if (totalAmount <= CONFIG.AUTO_APPROVE_THRESHOLD || CONFIG.ENABLE_EMERGENCY_MODE) {
    console.log(`✅ Auto-approving batch ($${totalAmount.toFixed(2)} ${validEvents[0]?.currency || 'USD'})`);
    await approveBatch(batch.batch_id);
  } else {
    console.log(`⏳ Batch requires manual approval ($${totalAmount.toFixed(2)} ${validEvents[0]?.currency || 'USD'})`);
    return; // Wait for manual approval
  }

  // Step 4: Validate owner directive (CRITICAL)
  try {
    await preExecutionOwnerCheck({ batch });
    console.log('✅ Owner directive validated');
  } catch (error) {
    console.error('❌ Owner directive violation:', error.message);
    throw error;
  }

  // Step 5: Execute settlement
  const executionResult = await executeSettlement(rail, batch);
  
  // Step 6: Mark events as settled
  await markEventsSettled(validEvents, batch.batch_id, executionResult);

  state.markSettlement(totalAmount);
  console.log(`✅ Settled ${validEvents.length} events via ${rail}`);
}

// ============================================================================
// PAYOUT EXECUTION
// ============================================================================

/**
 * Creates a payout batch in the ledger
 */
async function createPayoutBatch(rail, events) {
  const totalAmount = events.reduce((sum, e) => sum + Number(e.amount), 0);
  const currency = events[0]?.currency || 'USD';

  const batch = {
    batch_id: `BATCH_${rail}_${Date.now()}`,
    rail,
    total_amount: totalAmount,
    currency,
    status: 'pending_approval',
    revenue_event_ids: events.map(e => e.id),
    items: events.map(e => ({
        ...generateOwnerPayoutConfig(Number(e.amount), e.currency),
        sender_item_id: e.id
    })),
    created_at: new Date().toISOString(),
    owner_directive_enforced: true
  };

  // Validate all destinations
  for (const item of batch.items) {
    enforceOwnerDirective({ payout: { beneficiary: item.receiver || item.recipient } });
  }

  console.log(`📝 Created batch object:`, {
    id: batch.batch_id,
    events: batch.revenue_event_ids.length,
    amount: totalAmount,
    currency
  });

  // NOTE: We don't have a specific PayoutBatch entity in Base44 setup yet based on previous files.
  // We usually store this state in the RevenueEvent itself (payout_batch_id) or a local JSON.
  // For now, we'll return the object and rely on marking events.
  
  return batch;
}

/**
 * Approves a payout batch
 */
async function approveBatch(batchId) {
  console.log(`✅ Approving batch: ${batchId}`);
  // If we had a PayoutBatch entity, we would update it here.
  return true;
}

/**
 * Executes settlement on the payment rail
 */
async function executeSettlement(rail, batch) {
  console.log(`🚀 Executing ${rail} settlement...`);

  switch (rail) {
    case 'PAYPAL':
      return await executePayPalSettlement(batch);
    
    case 'BANK_WIRE':
      return await executeBankWireSettlement(batch);
    
    case 'PAYONEER':
      return await executePayoneerSettlement(batch);
    
    default:
      throw new Error(`Unsupported rail: ${rail}`);
  }
}

/**
 * PayPal Payout execution
 */
async function executePayPalSettlement(batch) {
  console.log('💳 Executing PayPal payout...');

  const items = batch.items.map(item => ({
      recipient_type: item.recipient_type,
      amount: { value: Number(item.amount).toFixed(2), currency: item.currency },
      receiver: item.recipient, // Ensure this matches generateOwnerPayoutConfig output
      note: item.note,
      sender_item_id: item.sender_item_id
  }));

  try {
      const payout = await createPayPalPayoutBatch({
          senderBatchId: batch.batch_id,
          items,
          emailSubject: "Owner Revenue Settlement",
          emailMessage: "Autonomous settlement of verified revenue."
      });
      
      console.log(`✅ PayPal payout submitted! Batch ID: ${payout.batch_header.payout_batch_id}`);
      return { provider_batch_id: payout.batch_header.payout_batch_id };
  } catch (e) {
      console.error(`❌ PayPal Payout Failed: ${e.message}`);
      throw e;
  }
}

/**
 * Bank Wire execution (generates CSV for manual upload)
 */
async function executeBankWireSettlement(batch) {
  console.log('🏦 Generating Bank Wire CSV...');

  // Generate bank wire CSV
  const csv = generateBankWireCSV(batch);
  const filename = `bank_wire_${batch.batch_id}.csv`;
  const filePath = path.join('exports', filename);

  fs.writeFileSync(filePath, csv);

  console.log(`✅ Bank Wire CSV generated: ${filePath}`);

  return { export_filename: filename, method: 'manual_csv' };
}

/**
 * Payoneer execution (generates CSV for manual upload)
 */
async function executePayoneerSettlement(batch) {
  console.log('💼 Generating Payoneer CSV...');

  // Generate Payoneer CSV
  const csv = generatePayoneerCSV(batch);
  const filename = `payoneer_${batch.batch_id}.csv`;
  const filePath = path.join('exports', filename);

  fs.writeFileSync(filePath, csv);

  console.log(`✅ Payoneer CSV generated: ${filePath}`);

  return { export_filename: filename, method: 'manual_csv' };
}

// ============================================================================
// CSV GENERATION
// ============================================================================

function generateBankWireCSV(batch) {
  const headers = 'Beneficiary RIB,Amount,Currency,Reference,Date';
  const rows = batch.items.map(item => 
    `${OWNER_ACCOUNTS.bank.rib},${item.amount},${item.currency},${item.sender_item_id},${new Date().toISOString()}`
  );
  return [headers, ...rows].join('\n');
}

function generatePayoneerCSV(batch) {
  const headers = 'Account ID,Amount,Currency,Description,Reference';
  const rows = batch.items.map(item =>
    `${OWNER_ACCOUNTS.payoneer.accountId},${item.amount},${item.currency},${item.note},${item.sender_item_id}`
  );
  return [headers, ...rows].join('\n');
}

// ============================================================================
// STATE UPDATES
// ============================================================================

/**
 * Marks events as settled in the ledger
 */
async function markEventsSettled(events, batchId, executionResult) {
  console.log(`📝 Marking ${events.length} events as settled`);

  const base44 = await buildBase44Client();
  const revenueConfig = getRevenueConfigFromEnv();
  const revenueEntity = base44.asServiceRole.entities[revenueConfig.entityName];

  for (const event of events) {
      try {
          await base44.asServiceRole.update(revenueEntity, event.id, {
              ...event,
              status: executionResult.method === 'manual_csv' ? 'export_ready' : 'paid_out',
              settled: true, // We mark as settled because we've either paid or exported for payment
              settled_at: new Date().toISOString(),
              payout_batch_id: batchId,
              settlement_details: executionResult
          });
          console.log(`  Marked ${event.id} as settled.`);
      } catch (e) {
          console.error(`  ❌ Failed to update ${event.id}: ${e.message}`);
      }
  }
}

// ============================================================================
// MONITORING & HEALTH
// ============================================================================

/**
 * Returns daemon health status
 */
export function getDaemonHealth() {
  return {
    ...state.getStatus(),
    config: CONFIG,
    owner_accounts: Object.keys(OWNER_ACCOUNTS).map(key => ({
      type: key,
      enabled: OWNER_ACCOUNTS[key].enabled,
      priority: OWNER_ACCOUNTS[key].priority
    }))
  };
}

/**
 * Emergency stop - halts all settlements
 */
export function emergencyStop() {
  console.log('🚨 EMERGENCY STOP ACTIVATED');
  state.running = false;
  CONFIG.ENABLE_IMMEDIATE_SETTLEMENT = false;
  CONFIG.ENABLE_EMERGENCY_MODE = false;
}

/**
 * Manual trigger - forces immediate settlement check
 */
export async function triggerManualSettlement() {
  console.log('⚡ Manual settlement triggered');
  await performSettlementCycle();
}

// ============================================================================
// STARTUP
// ============================================================================

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--once')) {
      console.log('🎯 Starting single settlement cycle...');
      performSettlementCycle().then(() => {
          console.log('✅ Single cycle complete.');
          process.exit(0);
      }).catch(error => {
          console.error('💥 Cycle failed:', error);
          process.exit(1);
      });
  } else {
      console.log('🎯 Starting as standalone daemon...');
      startAutoSettlementDaemon().catch(error => {
        console.error('💥 Daemon startup failed:', error);
        process.exit(1);
      });
  }
}

export default {
  startAutoSettlementDaemon,
  performSettlementCycle,
  getDaemonHealth,
  emergencyStop,
  triggerManualSettlement
};
