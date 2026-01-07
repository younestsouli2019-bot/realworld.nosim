import { OwnerSettlementEnforcer } from './owner-settlement.mjs';
import { shouldAvoidPayPal } from './geopolicy.mjs';

export function getEffectiveRoutes(amount, currency) {
  const cfg = OwnerSettlementEnforcer.getPaymentConfiguration();
  let routes = [...cfg.settlement_priority];
  if (shouldAvoidPayPal()) routes = routes.filter(r => r !== 'paypal');
  routes = routes.filter(r => !OwnerSettlementEnforcer.missingCredentials(r, cfg));
  const cur = String(currency || '').toUpperCase();
  if (cur === 'USDT' && cfg.supported_gateways.includes('tron')) {
    if (!routes.includes('tron')) routes.unshift('tron');
  }
  if (String(process.env.FORCE_BANK_WIRE || '').toLowerCase() === 'true') {
    const order = ['bank_transfer', 'crypto', 'payoneer', 'stripe', 'paypal'];
    const set = new Set(routes);
    routes = order.filter(r => set.has(r));
  }
  return routes;
}
