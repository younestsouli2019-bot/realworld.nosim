import crypto from "crypto";
import { verifyPaypalPayout } from "../providers/paypal/verify-payout.mjs";
import { verifyBankWire } from "../providers/bank/verify-wire.mjs";
import { appendProof } from "../ledger/proof-log.mjs";

export async function proveMoneyMoved({
  ledgerEntry,
  destination
}) {
  if (!ledgerEntry.external_tx_id) {
    throw new Error("INVARIANT VIOLATION: Missing external_tx_id");
  }

  let verification;

  if (destination.type === "PAYPAL") {
    verification = await verifyPaypalPayout(ledgerEntry.external_tx_id);
  } else if (destination.type === "BANK") {
    verification = await verifyBankWire(ledgerEntry.external_tx_id);
  } else {
    throw new Error(`Unknown payout destination type: ${destination.type}`);
  }

  // 🔒 HARD CHECKS
  if (!verification.confirmed) {
    throw new Error("INVARIANT VIOLATION: Funds not confirmed by provider");
  }

  if (verification.amount !== ledgerEntry.amount) {
    throw new Error(`INVARIANT VIOLATION: Amount mismatch (Ledger: ${ledgerEntry.amount}, Provider: ${verification.amount})`);
  }

  if (verification.currency !== ledgerEntry.currency) {
    throw new Error(`INVARIANT VIOLATION: Currency mismatch (Ledger: ${ledgerEntry.currency}, Provider: ${verification.currency})`);
  }

  // Strict destination check (might need normalization in production)
  if (verification.destination !== destination.address) {
    throw new Error(`INVARIANT VIOLATION: Destination mismatch (Expected: ${destination.address}, Got: ${verification.destination})`);
  }

  // 🔐 Cryptographic proof
  const proof = crypto
    .createHash("sha256")
    .update(JSON.stringify({
      ledger_id: ledgerEntry.id,
      external_tx_id: ledgerEntry.external_tx_id,
      amount: ledgerEntry.amount,
      ts: verification.timestamp
    }))
    .digest("hex");

  await appendProof({
    ledger_id: ledgerEntry.id,
    proof,
    provider: destination.type,
    external_tx_id: ledgerEntry.external_tx_id
  });

  return {
    ok: true,
    proof
  };
}
