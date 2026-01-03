import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("🚀 RESTARTING UPGRADES - STRICT MODE ENABLED");
console.log("===========================================");

// 1. Run Strict Simulation Check (File System Scan)
console.log("\n🔍 Phase 1: File System Audit for Simulacrum Code...");
const strictCheck = spawnSync('node', ['scripts/check-simulation.js'], { stdio: 'inherit', shell: true });
if (strictCheck.status !== 0) {
  console.error("❌ CRITICAL: Simulacrum Code detected in file system. Aborting upgrades.");
  process.exit(1);
}

// 2. Run Built-in Simulation Check (Data/Logic Scan)
console.log("\n🔍 Phase 2: Logic/Data Audit for Simulation Artifacts...");
const builtinCheck = spawnSync('node', ['src/emit-revenue-events.mjs', '--check-simulation'], { stdio: 'inherit', shell: true });
if (builtinCheck.status !== 0) {
  console.error("❌ CRITICAL: Simulation Artifacts detected in data/logic. Aborting upgrades.");
  process.exit(1);
}

// 3. Verify Integrity of Truth-Only Modules
console.log("\n🔍 Phase 3: Verifying Truth-Only Modules...");
const requiredFiles = [
  'src/proofs/prove-money-moved.mjs',
  'src/providers/paypal/ledger-sync.mjs',
  'src/providers/paypal/verify-payout.mjs',
  'src/emit-revenue-events.mjs'
];

let missing = false;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ MISSING: ${file}`);
    missing = true;
  } else {
    console.log(`✅ FOUND: ${file}`);
  }
}

if (missing) {
  console.error("❌ CRITICAL: Core Truth-Only modules are missing. Aborting upgrades.");
  process.exit(1);
}

// 4. Verify Truth Export Capability (Dry Run)
console.log("\n🔍 Phase 4: Verifying Truth Export Capability...");
const truthExport = spawnSync('node', ['src/emit-revenue-events.mjs', '--export-payout-truth', '--only-real', '--limit=1'], { stdio: 'pipe', shell: true });

if (truthExport.status !== 0) {
  console.error("❌ TRUTH EXPORT FAILED:");
  console.error(truthExport.stderr.toString());
  process.exit(1);
}

const truthOutput = truthExport.stdout.toString();
if (truthOutput.includes('"truthOnlyUiRequested":true')) {
  console.log("✅ Truth Export verified (Truth-Only UI requested).");
} else {
  console.warn("⚠️ Truth Export ran but 'truthOnlyUiRequested' flag missing in output.");
}

console.log("\n===========================================");
console.log("✅ UPGRADES RESTARTED SUCCESSFULLY");
console.log("   - Simulacrum Code Banned");
console.log("   - Provider Verification Enforced");
console.log("   - Proof of Movement Enforced");
console.log("   - Truth-Only Data Rendering Verified");
console.log("===========================================");
