
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

async function main() {
    console.log('🔗 INTEGRATING AUTONOMOUS SYSTEM...');

    // 1. Update auto-restart-loop.js
    const loopPath = path.join(ROOT_DIR, 'scripts', 'auto-restart-loop.js');
    let loopContent = fs.readFileSync(loopPath, 'utf8');

    // Check if already integrated
    if (!loopContent.includes('autonomous-revenue-generator.mjs')) {
        console.log('   ✏️  Updating auto-restart-loop.js...');
        
        // We replace the entire loop logic to prioritize the generator
        // We want to keep the restart logic, but change the tasks.
        
        const newLoopBody = `
            // 0. AUTONOMOUS REVENUE GENERATOR (The Correct System)
            console.log("\\n🚀 Running Autonomous Revenue Generator...");
            try {
                // This is a long-running process, so we await it. 
                // If it exits (crash), the loop will restart it.
                await runScript('scripts/autonomous-revenue-generator.mjs');
            } catch (e) {
                console.error("❌ Generator failed:", e.message);
                throw e; // Trigger restart
            }
        `;

        // Regex to replace the inner part of the loop or just overwrite the file with a clean version?
        // Overwriting is safer to ensure we remove the "wrong" logic.
        
        const newFileContent = `import { spawn } from 'child_process';
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
                reject(new Error(\`Script \${scriptPath} exited with code \${code}\`));
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

            // 1. Run the Autonomous Revenue Generator
            // This script handles: Mission Execution -> Revenue Generation -> Auto-Settlement
            console.log("\\n🚀 Running Autonomous Revenue Generator...");
            await runScript('scripts/autonomous-revenue-generator.mjs');

            console.log("✅ Generator exited cleanly. Restarting in 5s...");
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
`;
        fs.writeFileSync(loopPath, newFileContent);
        console.log('   ✅ auto-restart-loop.js updated.');
    } else {
        console.log('   ✅ auto-restart-loop.js already integrated.');
    }

    // 2. Update package.json
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    if (!pkg.scripts['start:autonomous']) {
        console.log('   ✏️  Updating package.json...');
        pkg.scripts['start:autonomous'] = "node ./scripts/autonomous-revenue-generator.mjs";
        // Update "start" to point to the loop which now points to the generator
        pkg.scripts['start'] = "node ./scripts/auto-restart-loop.js"; 
        
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log('   ✅ package.json updated.');
    }

    console.log('\n✅ INTEGRATION COMPLETE.');
    console.log('You can now run: npm start');
}

main().catch(console.error);
