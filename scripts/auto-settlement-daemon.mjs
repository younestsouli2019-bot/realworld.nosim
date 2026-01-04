import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';

// Configuration
const POLLING_INTERVAL_MS = 60000; // 1 minute
const IS_LIVE = process.env.SWARM_LIVE === 'true';

// Logger
const log = (msg) => console.log(`[${new Date().toISOString()}] [AUTO-SETTLEMENT] ${msg}`);

async function main() {
  log("🚀 Starting Auto-Settlement Daemon...");

  if (!IS_LIVE) {
    log("⚠️  WARNING: SWARM_LIVE is not set to 'true'.");
    log("   Daemon will run in SIMULATION/DRY-RUN mode.");
    log("   (Set SWARM_LIVE=true to enable actual file exports and state updates)");
  }

  const manager = new AdvancedFinancialManager();
  
  // Initial check
  await runCycle(manager);

  // Loop
  log(`💤 Sleeping for ${POLLING_INTERVAL_MS / 1000}s...`);
  setInterval(async () => {
    try {
      await runCycle(manager);
    } catch (err) {
      log(`❌ Error in cycle: ${err.message}`);
      console.error(err);
    }
  }, POLLING_INTERVAL_MS);
}

async function runCycle(manager) {
  log("🔄 Running settlement cycle...");

  // 1. Ingest Pending Revenue (Simulated or Real)
  // In a real scenario, this would poll an API or watch a folder.
  // For now, we rely on 'emit-revenue-events.mjs' to populate the storage.

  // 2. Reconcile
  const reconciliation = await manager.reconcile();
  if (reconciliation.discrepancies.length > 0) {
    log(`⚠️  Found ${reconciliation.discrepancies.length} reconciliation discrepancies.`);
  } else {
    log("✅ Reconciliation Clean.");
  }

  // 3. Process Recurring Payouts
  const payoutResults = await manager.processRecurringPayouts();
  if (payoutResults.length > 0) {
    log(`💸 Processed ${payoutResults.length} recurring payouts.`);
    payoutResults.forEach(p => log(`   - ${p.recipientId}: ${p.amount} ${p.currency} (Next: ${p.nextPayoutDate})`));
  } else {
    log("No pending recurring payouts.");
  }

  // 4. Export Bank Wires (Manual Step Automation)
  // This is where we would generate the bank wire files for 'Bucket B'
  // For now, we assume AdvancedFinancialManager handles the state, 
  // and we just log that we are watching.
  log("👀 Watching for pending settlements...");
}

// Start
main().catch(err => {
  console.error("Fatal Daemon Error:", err);
  process.exit(1);
});
