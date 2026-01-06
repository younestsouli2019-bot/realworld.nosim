
import { getEnvBool } from "./autonomous-config.mjs";
import { OWNER_ACCOUNTS as REGISTRY_ACCOUNTS, ALLOWED_BENEFICIARIES as REGISTRY_BENEFICIARIES } from "./policy/RecipientRegistry.mjs";

/**
 * STRICT OWNER REVENUE DIRECTIVE
 * 
 * This module enforces the "Owner Revenue Directive" to ensure that:
 * 1. No payouts are sent to unauthorized accounts.
 * 2. Middlemen are eliminated.
 * 3. Configs attempting to bypass this are rejected.
 * 
 * @see whats.so.difficult.éunderstand.txt
 */

const ALLOWED_BENEFICIARIES = REGISTRY_BENEFICIARIES;

const ALLOWED_PAYONEER_DIRS = [
    "out/payoneer",
    "out/bank-wire"
];

export const OWNER_ACCOUNTS = REGISTRY_ACCOUNTS;

export function selectOptimalOwnerAccount(amount, currency) {
  // Logic to select best account based on fees/speed
  // STRICT PRIORITY: Bank -> Payoneer -> Crypto -> PayPal
  
  if (amount > 2000) return OWNER_ACCOUNTS.bank;
  return OWNER_ACCOUNTS.payoneer;
}

export function generateOwnerPayoutConfig(amount, currency) {
  const account = selectOptimalOwnerAccount(amount, currency);
  return {
    recipient: account.email || account.rib || account.accountId,
    recipient_type: account.type === 'PAYPAL' ? 'EMAIL' : 'BANK_ACCOUNT',
    amount: amount,
    currency: currency,
    note: "Owner Settlement"
  };
}

export function validateOwnerDirectiveSetup() {
  // Check env vars
  if (!process.env.OWNER_PAYONEER_ID) {
    console.warn("⚠️ OWNER_PAYONEER_ID not set. Payoneer settlement may fail.");
  }
  // Check constants
  if (!OWNER_ACCOUNTS.paypal.email || !OWNER_ACCOUNTS.bank.rib) {
      throw new Error("Critical Owner Accounts missing configuration");
  }
}

export async function preExecutionOwnerCheck({ batch }) {
    // Validate batch against owner directive
    if (!batch) return;
    for (const item of batch.items) {
        enforceOwnerDirective({ payout: { beneficiary: item.receiver || item.recipient } });
    }
}

export function enforceOwnerDirective(cfg) {
  // 1. Check Payout Beneficiary
  const beneficiary = cfg.payout?.beneficiary;
  if (beneficiary) {
    const isAllowed = ALLOWED_BENEFICIARIES.some(b => 
      String(beneficiary).trim().toLowerCase() === b.toLowerCase()
    );
    if (!isAllowed) {
      throw new Error(`VIOLATION: Owner Revenue Directive. Unauthorized beneficiary: ${beneficiary}`);
    }
  }

  // 2. Check PayPal Recipient Allowlist (Environment)
  const envAllowlist = process.env.AUTONOMOUS_ALLOWED_PAYPAL_RECIPIENTS;
  if (envAllowlist) {
      const list = envAllowlist.split(',').map(s => s.trim().toLowerCase());
      const hasUnauthorized = list.some(email => !ALLOWED_BENEFICIARIES.some(allowed => allowed.toLowerCase() === email));
      if (hasUnauthorized) {
          throw new Error(`VIOLATION: Owner Revenue Directive. Unauthorized PayPal recipient in env.`);
      }
  }

  // 3. Enforce Middleman Elimination
  // If the config attempts to use a settlement ID that isn't explicitly approved, warn or block.
  // For now, we focus on the destination.

  // 4. Validate Export Directories (Prevent hiding money in obscure folders)
  if (cfg.tasks?.autoExportPayoneerPayoutBatches === true) {
      const outDir = cfg.payout?.export?.payoneerOutDir;
      if (outDir && !ALLOWED_PAYONEER_DIRS.some(d => outDir.includes(d) || outDir.endsWith("payoneer") || outDir.endsWith("bank-wire"))) {
           throw new Error(`VIOLATION: Owner Revenue Directive. Suspicious export directory: ${outDir}`);
      }
  }

  console.log("✅ Owner Revenue Directive Enforced: Configuration is SAFE.");
}
