import { SmartSettlementOrchestrator } from '../src/financial/SmartSettlementOrchestrator.mjs';

async function run() {
  const orchestrator = new SmartSettlementOrchestrator();
  const results = await orchestrator.routeAndExecute(1200, 'USD');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(e => {
  console.error('DEMO_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
