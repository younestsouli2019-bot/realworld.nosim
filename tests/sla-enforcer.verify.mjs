import { OwnerSettlementEnforcer } from '../src/policy/owner-settlement.mjs';

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
  const old = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
  const events = [
    { id: 'old1', amount: 50, currency: 'USD', settlement_method: 'bank', created_date: old, status: 'VERIFIED', metadata: {} },
    { id: 'new1', amount: 60, currency: 'USD', settlement_method: 'bank', created_date: new Date().toISOString(), status: 'VERIFIED', metadata: {} }
  ];
  await OwnerSettlementEnforcer.settleAllRecoveredEvents(events, manager);
  const out = saved.map(s => ({ id: s.id, status: s.data.status, sla: s.data.metadata?.sla_violation || false }));
  console.log(JSON.stringify({ saved: out, auditsCount: audits.length }, null, 2));
}

run().catch(e => {
  console.error('TEST_FAILED', e && e.message ? e.message : String(e));
  process.exit(1);
});
