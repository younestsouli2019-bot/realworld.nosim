#!/usr/bin/env node
// scripts/emergency-settlement.mjs
// EMERGENCY SETTLEMENT FOR SLA BREACHES

import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';
import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';

const manager = new AdvancedFinancialManager();

async function emergencySettlement() {
  console.log('⚡ INITIATING EMERGENCY SETTLEMENT PROTOCOL...');
  await manager.initialize();

  const allEvents = manager.storage.list('events');
  const now = Date.now();
  
  // Find SLA Breaches: Verified events older than 30 days not yet settled
  const slaBreachEvents = allEvents.filter(e => {
    if (e.status === 'verified' || e.status === 'pending_reconciliation') {
      const age = now - new Date(e.timestamp).getTime();
      return age > (30 * 24 * 60 * 60 * 1000); // 30 days
    }
    return false;
  });

  console.log(`📋 Found ${slaBreachEvents.length} SLA breaches (older than 30 days).`);

  // Group by Agent
  const eventsByAgent = slaBreachEvents.reduce((acc, event) => {
    const agent = (event.attribution && event.attribution.agent_id) || 'unknown';
    acc[agent] = acc[agent] || [];
    acc[agent].push(event);
    return acc;
  }, {});

  for (const [agentId, events] of Object.entries(eventsByAgent)) {
    console.log(`\n  🚨 Processing batch for ${agentId}: ${events.length} events`);
    
    const batchId = `EMERGENCY_${Date.now()}_${agentId}`;
    let batchTotal = 0;

    for (const event of events) {
      console.log(`    -> Settling ${event.id} ($${event.amount})...`);
      
      // Enforce Owner Settlement via Policy
      await OwnerSettlementEnforcer.settleAllRecoveredEvents([event], manager);
      
      batchTotal += event.amount;
    }

    console.log(`    ✅ Batch ${batchId} Complete. Total Settled: $${batchTotal.toFixed(2)}`);
    console.log(`    ⚠️  ACTION REQUIRED: Retrain/Review Agent ${agentId} for performance failure.`);
  }

  console.log('\n✅ Emergency Settlement Complete.');
}

if (process.argv[1] === import.meta.url || process.argv[1].endsWith('emergency-settlement.mjs')) {
  emergencySettlement().catch(console.error);
}
