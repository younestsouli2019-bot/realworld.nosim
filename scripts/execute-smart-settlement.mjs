// scripts/execute-smart-settlement.mjs
import { SmartSettlementOrchestrator } from '../src/financial/SmartSettlementOrchestrator.mjs';

async function run() {
  try {
    const orchestrator = new SmartSettlementOrchestrator();
    
    // Amount from original task
    const AMOUNT = 850.00;
    const CURRENCY = 'USDT';

    console.log(`🚀 INITIATING SMART SETTLEMENT PROTOCOL`);
    console.log(`   Target: ${AMOUNT} ${CURRENCY}`);
    
    await orchestrator.routeAndExecute(AMOUNT, CURRENCY);

  } catch (error) {
    console.error('CRITICAL FAILURE:', error);
  }
}

run();
