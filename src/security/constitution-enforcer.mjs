import { OwnerSettlementEnforcer } from '../policy/owner-settlement.mjs';

export function enforceOwnerSettlementForRoute(route, transactions) {
  const dest = OwnerSettlementEnforcer.getOwnerAccountForType(route === 'bank_transfer' ? 'bank' : route);
  const remapped = transactions.map(t => ({
    amount: Number(t.amount || 0),
    currency: t.currency || 'USD',
    destination: dest,
    reference: t.reference || ''
  }));
  return remapped;
}

export function validateRevenueRecord(record) {
  const hasProof = !!record?.proof && (!!record?.proof?.webhook || !!record?.proof?.transaction_id || !!record?.proof?.signature);
  const hasAmount = Number(record?.amount || 0) > 0;
  const hasPsp = !!record?.psp;
  return hasProof && hasAmount && hasPsp;
}

