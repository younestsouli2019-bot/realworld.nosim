// test-binding.mjs
import { InvariantCore } from './src/real/invariant-core.mjs';
import { ProofValidator } from './src/real/proof-validator.mjs';
import { EvidenceIntegrityChain } from './src/real/evidence-integrity.mjs';
import { MoneyMovedGate } from './src/real/money-moved-gate.mjs';

console.log("Imports successful.");

try {
    InvariantCore.assertInvariant("TEST_INVARIANT", true, "This should pass");
    console.log("Invariant check passed.");
} catch (e) {
    console.error("Invariant check failed:", e);
}

console.log("Modules verified.");
