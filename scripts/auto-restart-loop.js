import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import '../src/load-env.mjs';

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
                BASE44_OFFLINE: 'true',
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
    console.log("♾️  STARTING AUTONOMOUS REVENUE SYSTEM LOOP ♾️");
    
    while (true) {
        try {
            if (restartsInLastMinute > MAX_RESTARTS_PER_MINUTE) {
                console.error("⚠️  Too many restarts. Pausing for 30 seconds...");
                await new Promise(r => setTimeout(r, 30000));
                restartsInLastMinute = 0;
            }

            // 1. Run the Swarm Orchestrator (New Entry Point)
            // This script handles: Mission Execution -> Revenue Generation -> Auto-Settlement
            console.log("\n🚀 Running Swarm Orchestrator...");
            await runScript('scripts/run-swarm-orchestrated.mjs');

            console.log("✅ Orchestrator exited cleanly. Restarting in 5s...");
            await new Promise(r => setTimeout(r, 5000));

        } catch (error) {
            console.error("❌ LOOP ERROR:", error.message);
            restartsInLastMinute++;
            console.log("🔄 Restarting loop in 5 seconds...");
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

process.on('SIGINT', () => {
    console.log("🛑 Received SIGINT. Exiting loop.");
    process.exit(0);
});

loop();
