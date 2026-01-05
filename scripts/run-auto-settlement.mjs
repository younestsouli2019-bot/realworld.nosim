import { SmartSettlementOrchestrator } from '../src/financial/SmartSettlementOrchestrator.mjs';

async function run() {
  const orchestrator = new SmartSettlementOrchestrator();
  const amount = Number(process.env.AUTO_AMOUNT || 1000);
  const currency = process.env.AUTO_CURRENCY || 'USD';
  await orchestrator.routeAndExecute(amount, currency);
  console.log('AUTO_RUN_COMPLETE');
}

run().catch(e => {
  console.error('AUTO_RUN_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
