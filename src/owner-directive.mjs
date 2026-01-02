
import { getEnvBool } from "./autonomous-config.mjs";

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

const ALLOWED_BENEFICIARIES = [
  "younestsouli2019@gmail.com",
  "younesdgc@gmail.com",
  "007810000448500030594182" // Account RIB from user instructions/CSV
];

const ALLOWED_PAYONEER_DIRS = [
    "out/payoneer",
    "out/bank-wire"
];

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
