import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import '../src/load-env.mjs'; // Load environment variables from .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MAX_RESTARTS_PER_MINUTE = 5;
let restartsInLastMinute = 0;
let lastRestartReset = Date.now();

// Reset restart counter every minute
setInterval(() => {
    restartsInLastMinute = 0;
    lastRestartReset = Date.now();
}, 60000);

async function runScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', [scriptPath, ...args], {
            cwd: ROOT_DIR,
            stdio: 'inherit',
            env: {
                ...process.env,
                BASE44_OFFLINE: 'true', // Force offline to avoid WebSocket hang
                BASE44_ALLOW_OFFLINE_FALLBACK: 'true',
                SWARM_LIVE: 'true'
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Script ${scriptPath} exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function loop() {
    console.log("♾️  STARTING AUTO-RESTART LOOP ♾️");
    
    while (true) {
        try {
            if (restartsInLastMinute > MAX_RESTARTS_PER_MINUTE) {
                console.error("⚠️  Too many restarts. Pausing for 30 seconds...");
                await new Promise(r => setTimeout(r, 30000));
                restartsInLastMinute = 0;
            }

            // 0. Transform CSVs to JSON
            console.log("\n🔄 Running CSV Transformation...");
            try {
                await runScript('scripts/transform-csv-to-real.mjs');
            } catch (e) {
                console.warn("⚠️ Transformation warning (continuing):", e.message);
            }

            // 1. Ingest Real Entities (Process any new CSVs)
            console.log("\n📥 Running Ingestion...");
            try {
                await runScript('scripts/ingest-real-entities.mjs');
            } catch (e) {
                console.warn("⚠️ Ingestion warning (continuing):", e.message);
            }

            // 1.5. Enforce Settlement SLA (Evidence Collection Mode)
            console.log("\n👮 Enforcing Settlement SLA...");
            try {
                await runScript('src/emit-revenue-events.mjs', ['--enforce-sla']);
            } catch (e) {
                console.warn("⚠️ SLA Enforcement warning (continuing):", e.message);
            }

            // 1.6. Emit Revenue Events & Process Payouts (Obligation Mandatory)
            console.log("\n💸 Processing Payouts (Obligation Mandatory)...");
            try {
                // Ensure we run the revenue emission logic to create payout batches
                await runScript('src/emit-revenue-events.mjs');
            } catch (e) {
                console.warn("⚠️ Payout processing warning (continuing):", e.message);
            }

            // 2. Run Real Execution Loop
            console.log("\n🔥 Running Real Execution Loop...");
            await runScript('src/real/real-execution-loop.mjs');

            console.log("✅ Loop iteration complete. Sleeping for 10s...");
            await new Promise(r => setTimeout(r, 10000));

        } catch (error) {
            console.error("❌ LOOP ERROR:", error.message);
            restartsInLastMinute++;
            console.log("🔄 Restarting loop in 5 seconds...");
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

// Handle exit signals to cleanup if needed (though we want to persist)
process.on('SIGINT', () => {
    console.log("🛑 Received SIGINT. Exiting loop.");
    process.exit(0);
});

loop();
