import { SmartSettlementOrchestrator } from '../src/financial/SmartSettlementOrchestrator.mjs';

async function run() {
  const orchestrator = new SmartSettlementOrchestrator();
  await orchestrator.reconcileQueue();
  console.log('FORCE_RECONCILE_DONE');
}

run().catch(e => {
  console.error('FORCE_RECONCILE_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
