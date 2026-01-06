import { OwnerSettlementEnforcer } from '../policy/owner-settlement.mjs';
import { getEffectiveRoutes } from '../policy/route-optimizer.mjs';

export function check() {
  const cfg = OwnerSettlementEnforcer.getPaymentConfiguration();
  const base = cfg.settlement_priority;
  const effective = getEffectiveRoutes();
  const creds = cfg.credentials || {};
  const issues = [];
  if (!creds.paypal?.client_id || !creds.paypal?.has_secret) issues.push('paypal_credentials_missing');
  if (!creds.stripe?.has_secret) issues.push('stripe_credentials_missing');
  if (!creds.payoneer?.has_token) issues.push('payoneer_token_missing');
  const status = { base, effective, issues };
  return status;
}

