import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_DIR = __dirname;

// List of critical test scripts to run
const TEST_SUITE = [
    'test-swarm-orchestrator.mjs',
    'test-reconciliation-logic.mjs',
    'test-revenue-flow.mjs',
    'test-advanced-finance.mjs',
    'test-legal-compliance.mjs',
    'test-owner-check.mjs',
    'verify-live-mode-compliance.js'
];

async function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        console.log(`\n🧪 RUNNING: ${scriptName}...`);
        const scriptPath = path.join(SCRIPTS_DIR, scriptName);
        
        if (!fs.existsSync(scriptPath)) {
            console.error(`   ❌ Script not found: ${scriptName}`);
            resolve(false);
            return;
        }

        const child = spawn('node', [scriptPath], { stdio: 'inherit' });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`   ✅ PASSED: ${scriptName}`);
                resolve(true);
            } else {
                console.error(`   ❌ FAILED: ${scriptName} (Exit Code: ${code})`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            console.error(`   ❌ ERROR launching ${scriptName}:`, err);
            resolve(false);
        });
    });
}

async function runSuite() {
    console.log('🚀 STARTING FULL SYSTEM TEST SUITE');
    console.log('===================================');
    
    let passed = 0;
    let failed = 0;

    for (const script of TEST_SUITE) {
        const success = await runScript(script);
        if (success) passed++;
        else failed++;
    }

    console.log('\n===================================');
    console.log(`📊 TEST SUMMARY:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Total:  ${TEST_SUITE.length}`);
    
    if (failed > 0) {
        console.error('❌ SYSTEM INTEGRITY CHECK FAILED');
        process.exit(1);
    } else {
        console.log('✅ ALL SYSTEMS OPERATIONAL');
        process.exit(0);
    }
}

runSuite();
