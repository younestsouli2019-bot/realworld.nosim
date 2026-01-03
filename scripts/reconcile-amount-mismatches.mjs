import { buildBase44Client } from "../src/base44-client.mjs";
import { getRevenueConfigFromEnv } from "../src/base44-revenue.mjs";
import "../src/load-env.mjs";
import fs from 'fs';

async function reconcileAmountMismatches() {
  console.log("💰 Starting Amount Mismatch Reconciliation...");

  const base44 = await buildBase44Client();
  const revenueConfig = getRevenueConfigFromEnv();
  const revenueEntity = base44.asServiceRole.entities[revenueConfig.entityName];

  let allEvents = [];
  let page = 1;
  while (true) {
      const res = await base44.asServiceRole.list(revenueEntity, { page, perPage: 100 });
      allEvents = allEvents.concat(res.items);
      if (page >= res.totalPages) break;
      page++;
  }

  const mismatches = allEvents.filter(e => {
      if (!e.verification_proof || !e.verification_proof.amount) return false;
      const ledgerAmount = Number(e.amount);
      const proofAmount = Number(e.verification_proof.amount);
      return Math.abs(ledgerAmount - proofAmount) > 0.01; // Tolerance for float math
  });

  console.log(`Found ${mismatches.length} amount mismatches.`);

  const correctionsLog = [];

  for (const event of mismatches) {
      const ledgerAmount = Number(event.amount);
      const proofAmount = Number(event.verification_proof.amount);
      const diff = Math.abs(ledgerAmount - proofAmount);

      console.log(`\n⚠️ Mismatch for ${event.id}: Ledger=$${ledgerAmount}, Proof=$${proofAmount} (Diff: $${diff.toFixed(2)})`);

      // CORRECTION: PSP IS TRUTH
      const correctedEvent = {
          ...event,
          amount: proofAmount,
          notes: {
              ...(event.notes || {}),
              correction_log: `Corrected from ${ledgerAmount} to ${proofAmount} based on PSP proof. Diff: ${diff}`
          },
          discrepancy_resolved: true,
          resolved_at: new Date().toISOString()
      };

      try {
          await base44.asServiceRole.update(revenueEntity, event.id, correctedEvent);
          console.log(`  ✅ Corrected ${event.id} to $${proofAmount}`);
          
          correctionsLog.push({
              eventId: event.id,
              oldAmount: ledgerAmount,
              newAmount: proofAmount,
              diff,
              timestamp: new Date().toISOString()
          });

      } catch (e) {
          console.error(`  ❌ Failed to update ${event.id}: ${e.message}`);
      }
  }

  // Save audit trail
  if (correctionsLog.length > 0) {
      fs.writeFileSync('data/amount-corrections-audit.json', JSON.stringify(correctionsLog, null, 2));
      console.log(`\n📋 Audit trail saved to data/amount-corrections-audit.json`);
  }
}

import { pathToFileURL } from 'url';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  reconcileAmountMismatches().catch(console.error);
}

export { reconcileAmountMismatches };
