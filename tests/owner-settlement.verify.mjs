import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';
import { threatMonitor } from '../src/security/threat-monitor.mjs';

const saved = [];
const audits = [];

const manager = {
  storage: {
    async save(collection, id, data) {
      saved.push({ collection, id, data });
    }
  },
  audit: {
    async log(type, id, user, info, source, extra) {
      audits.push({ type, id, user, info, source, extra });
    }
  }
};

async function run() {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_SECRET;
  delete process.env.PAYONEER_TOKEN;
  delete process.env.STRIPE_SECRET_KEY;

  const events = [
    { id: 'e1', amount: 100, currency: 'USD', settlement_method: 'paypal', metadata: {} },
    { id: 'e2', amount: 200, currency: 'USD', settlement_method: 'bank', metadata: {} },
    { id: 'e3', amount: 300, currency: 'USD', settlement_method: 'payoneer', metadata: {} },
    { id: 'e4', amount: 400, currency: 'USD', settlement_method: 'bank', metadata: {} },
  ];

  threatMonitor.activateBunkerMode();
  await OwnerSettlementEnforcer.settleAllRecoveredEvents([events[0], events[1]], manager);
  threatMonitor.deactivateBunkerMode();
  await OwnerSettlementEnforcer.settleAllRecoveredEvents([events[2], events[3]], manager);

  const out = saved.map(s => ({ id: s.id, status: s.data.status, queue_reason: s.data.metadata?.queue_reason, verification_error: s.data.metadata?.verification_error }));
  console.log(JSON.stringify({ saved: out, auditsCount: audits.length }, null, 2));
}

run().catch(e => {
  console.error('TEST_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
