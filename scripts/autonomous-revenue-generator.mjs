#!/usr/bin/env node
// scripts/autonomous-revenue-generator.mjs
// AUTONOMOUS FINANCIAL ORCHESTRATOR
// STRICTLY ENFORCES FINANCIAL POLICY & SETTLEMENT
// NO "CONTENT FARM" / "BLOGGING" LOGIC

import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';
import { SmartSettlementOrchestrator } from '../src/financial/SmartSettlementOrchestrator.mjs';
import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';
import { getEnvBool } from '../src/autonomous-config.mjs';
import { reconcileAmountMismatches } from './reconcile-amount-mismatches.mjs';

// Load environment variables via --env-file or assumes pre-loaded

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Operational Mode
  liveMode: process.env.SWARM_LIVE === 'true',
  
  // Timing
  tickRate: 60000, // Run every 60 seconds
  
  // Limits
  dailyLimit: parseFloat(process.env.DAILY_TRANSACTION_LIMIT) || 1000,
  maxSingleTx: parseFloat(process.env.MAX_SINGLE_TRANSACTION) || 500
};

// ============================================================================
// FINANCIAL ORCHESTRATOR
// ============================================================================

export class FinancialOrchestrator {
  constructor() {
    this.manager = new AdvancedFinancialManager();
    this.smartSettlement = new SmartSettlementOrchestrator();
    this.stats = {
      cycles: 0,
      reconciledEvents: 0,
      payoutsProcessed: 0,
      settledVolume: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('\n🏦 INITIALIZING FINANCIAL ORCHESTRATOR');
    console.log('='.repeat(50));
    console.log(`   Mode: ${CONFIG.liveMode ? '🔴 LIVE' : '⚪ RESTRICTED (No Money Movement)'}`);
    console.log(`   Manager: AdvancedFinancialManager`);
    console.log(`   Settlement: SmartSettlementOrchestrator`);
    console.log(`   Owner Identity: ${OwnerSettlementEnforcer.getOwnerIdentity().name}`);
    console.log('='.repeat(50));

    if (!CONFIG.liveMode) {
      console.warn('⚠️  WARNING: Running in RESTRICTED/SAFE mode.');
      console.warn('   Set SWARM_LIVE=true to enable real financial settlement.');
    }
  }

  async autoResolveDiscrepancies(discrepancies) {
    console.log('   🛠️  Auto-Resolving Discrepancies...');

    // 1. Filter for Amount Mismatches (handled by specialized script logic)
    const amountMismatches = discrepancies.filter(d => d.type === 'AMOUNT_MISMATCH');
    if (amountMismatches.length > 0) {
      console.log(`      -> Delegating ${amountMismatches.length} Amount Mismatches to Reconcile Logic...`);
      try {
        await reconcileAmountMismatches();
        console.log('      ✅ Amount Mismatches Reconciled.');
      } catch (e) {
        console.error('      ❌ Failed to reconcile amount mismatches:', e.message);
      }
    }

    // 2. Handle other types
    for (const disc of discrepancies) {
      if (disc.type === 'STALLED_EVENT') {
        // Auto-Resolution for Trivial Amounts
        const trivialThreshold = 1.0;
        // Use exposed amount or parse from details
        const amount = disc.amount !== undefined ? Number(disc.amount) : Number(disc.details.match(/Amount: \$([\d.]+)/)?.[1] || 0);

        if (amount > 0 && amount < trivialThreshold) {
             console.log(`      -> Auto-Writeoff Stalled Event ${disc.id} ($${amount} < $1)`);
             try {
                // Adjust to 0
                const event = this.manager.storage.load('events', disc.id);
                if (event) {
                    event.amount = 0;
                    event.status = 'written_off';
                    event.metadata = { ...event.metadata, writeoff_reason: 'Stalled Trivial Amount', auto_resolved: true };
                    this.manager.storage.save('events', disc.id, event);
                    console.log(`      ✅ Written off ${disc.id}`);
                }
             } catch (e) {
                 console.error(`      ❌ Failed to write-off ${disc.id}: ${e.message}`);
             }
        } else {
             console.log(`      -> Flagging Stalled Event ${disc.id} for manual review (Amount: $${amount} or Unknown).`);
        }
      }
      else if (disc.type === 'MISSING_ATTRIBUTION') {
        console.log(`      -> Patching Missing Attribution for ${disc.id} -> 'unknown_legacy'`);
        try {
            const event = this.manager.storage.load('events', disc.id);
            if (event) {
                event.attribution = { ...event.attribution, agent_id: 'unknown_legacy', auto_patched: true };
                this.manager.storage.save('events', disc.id, event);
                console.log(`      ✅ Patched attribution for ${disc.id}`);
            }
        } catch (e) {
            console.error(`      ❌ Failed to patch attribution for ${disc.id}: ${e.message}`);
        }
      }
    }
  }

  /**
   * Identifies 'verified' revenue events and routes them to the Owner via SmartSettlement
   */
  async settlePendingRevenue() {
    process.stdout.write(`   [Settlement] Checking pending revenue... `);
    
    // 1. Load Events
    const events = this.manager.storage.list('events');
    const pendingEvents = events.filter(e => e.status === 'verified'); // Verified by Proof, ready to settle

    if (pendingEvents.length === 0) {
        console.log(`✅ Nothing to settle.`);
        return;
    }

    // 2. Group by Currency
    const batches = {};
    pendingEvents.forEach(e => {
        const currency = e.currency || 'USD';
        if (!batches[currency]) batches[currency] = [];
        batches[currency].push(e);
    });

    console.log(`Found ${pendingEvents.length} pending events.`);

    // 3. Process Batches
    for (const [currency, batchEvents] of Object.entries(batches)) {
        const totalAmount = batchEvents.reduce((sum, e) => sum + e.amount, 0);
        console.log(`      -> Batch: ${batchEvents.length} events, Total: ${totalAmount.toFixed(2)} ${currency}`);

        if (totalAmount <= 0) continue;

        try {
            // 4. Route via Smart Settlement
            // Note: routeAndExecute returns an array of "steps" (allocations)
            const routingResults = await this.smartSettlement.routeAndExecute(totalAmount, currency);

            // 5. Update Events based on Routing
            // Since routing might be split (part sent, part queued), we need to handle this.
            // Simplified Strategy: If ANY part is queued, we mark events as 'queued_for_settlement'.
            // If ALL parts are IN_TRANSIT/SENT, we mark as 'settled'.
            
            const anyQueued = routingResults.some(r => r.status.includes('QUEUED'));
            const anyFailed = routingResults.some(r => r.status.includes('FAILED'));
            
            let newStatus = 'settled';
            let note = 'Settled via SmartOrchestrator';

            if (anyFailed) {
                newStatus = 'failed_settlement';
                note = 'Settlement Failed - Retrying later';
            } else if (anyQueued) {
                newStatus = 'queued_settlement'; // Intermediate state, effectively still pending but acknowledged
                note = 'Queued due to limits/resources';
            }

            // Apply updates
            for (const event of batchEvents) {
                const updatedEvent = {
                    ...event,
                    status: newStatus,
                    settlement_history: [
                        ...(event.settlement_history || []),
                        {
                            date: new Date().toISOString(),
                            status: newStatus,
                            routing: routingResults,
                            note
                        }
                    ]
                };
                
                // If settled, enforce Owner Destination Metadata
                if (newStatus === 'settled') {
                     const enforced = OwnerSettlementEnforcer.enforceOwnerDestination(event);
                     updatedEvent.settlement_info = enforced;
                }

                this.manager.storage.save('events', event.id, updatedEvent);
            }
            
            if (newStatus === 'settled') {
                this.stats.settledVolume += totalAmount;
                console.log(`      ✅ Settled ${batchEvents.length} events for ${totalAmount} ${currency}`);
            } else {
                console.log(`      ⏳ Batch status updated to: ${newStatus}`);
            }

        } catch (err) {
            console.error(`      ❌ Batch Settlement Error: ${err.message}`);
        }
    }
  }

  async tick() {
    this.stats.cycles++;
    const cycleId = `CYC_${Date.now()}`;
    console.log(`\n🔄 [${cycleId}] Starting Financial Cycle...`);

    try {
      // 1. RECONCILIATION
      // Checks for consistency between Revenue Events and Settlement Status
      process.stdout.write(`   [Reconcile] Running... `);
      const reconciliation = await this.manager.reconcile();
      const discrepancyCount = reconciliation.discrepancies.length;
      if (discrepancyCount > 0) {
        console.log(`⚠️  FOUND ${discrepancyCount} DISCREPANCIES`);
        await this.autoResolveDiscrepancies(reconciliation.discrepancies);
      } else {
        console.log(`✅ Clean`);
      }
      this.stats.reconciledEvents += reconciliation.processed_count || 0;

      // 2. RECURRING PAYOUTS (Salaries, Expenses)
      // Processes scheduled payments
      process.stdout.write(`   [Payouts]   Checking schedules... `);
      const payouts = await this.manager.processRecurringPayouts();
      if (payouts.length > 0) {
        console.log(`💸 EXECUTED ${payouts.length} PAYOUTS`);
        payouts.forEach(p => console.log(`      -> ${p.recipientId}: ${p.amount} ${p.currency}`));
        this.stats.payoutsProcessed += payouts.length;
      } else {
        console.log(`✅ None due`);
      }

      // 3. OWNER SETTLEMENT SWEEP (Revenue -> Owner)
      // STRICTLY ROUTES AVAILABLE REVENUE TO OWNER ACCOUNTS
      await this.settlePendingRevenue();

    } catch (error) {
      console.error(`\n❌ [${cycleId}] CYCLE ERROR:`, error.message);
      this.stats.errors++;
    }
  }

  printStats() {
    console.log('\n📊 ORCHESTRATOR STATISTICS');
    console.log(`   Cycles:           ${this.stats.cycles}`);
    console.log(`   Payouts (Exp):    ${this.stats.payoutsProcessed}`);
    console.log(`   Settled Volume:   $${this.stats.settledVolume.toFixed(2)}`);
    console.log(`   Errors:           ${this.stats.errors}`);
    console.log('---------------------------');
  }

  async start() {
    await this.initialize();

    // Initial run
    await this.tick();

    // Loop
    setInterval(() => this.tick(), CONFIG.tickRate);
    
    // Stats loop (every 5 mins)
    setInterval(() => this.printStats(), 300000);

    console.log(`\n✅ Orchestrator running. Press Ctrl+C to stop.\n`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const orchestrator = new FinancialOrchestrator();
  await orchestrator.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

import { pathToFileURL } from 'url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
}
