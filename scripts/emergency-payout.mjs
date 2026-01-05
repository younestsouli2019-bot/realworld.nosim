import { PayoneerGateway } from '../src/financial/gateways/PayoneerGateway.mjs';
import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';

async function run() {
  const gw = new PayoneerGateway();
  const dest = OwnerSettlementEnforcer.getOwnerAccountForType('payoneer');
  const amt = Number(process.env.EMERGENCY_AMOUNT || 500);
  const cur = process.env.EMERGENCY_CURRENCY || 'USD';
  const res = await gw.generateBatch([{ amount: amt, currency: cur, destination: dest, reference: 'Emergency Payout' }]);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(e => {
  console.error('EMERGENCY_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
