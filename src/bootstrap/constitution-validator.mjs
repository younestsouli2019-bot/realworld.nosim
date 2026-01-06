import { OWNER_ACCOUNTS, ALLOWED_BENEFICIARIES } from '../policy/RecipientRegistry.mjs';
import { PRIME_DIRECTIVE } from '../policy/constitution.mjs';

export function validateSwarm() {
  const issues = [];
  if (!PRIME_DIRECTIVE || PRIME_DIRECTIVE.length < 10) issues.push('prime_directive_missing');
  if (!OWNER_ACCOUNTS?.bank?.rib) issues.push('owner_bank_missing');
  if (!OWNER_ACCOUNTS?.payoneer?.email) issues.push('owner_payoneer_missing');
  if (!OWNER_ACCOUNTS?.paypal?.email) issues.push('owner_paypal_missing');
  if (!OWNER_ACCOUNTS?.crypto?.address) issues.push('owner_crypto_missing');
  if (!Array.isArray(ALLOWED_BENEFICIARIES) || ALLOWED_BENEFICIARIES.length === 0) issues.push('beneficiaries_missing');
  const ok = issues.length === 0;
  return { ok, issues };
}

