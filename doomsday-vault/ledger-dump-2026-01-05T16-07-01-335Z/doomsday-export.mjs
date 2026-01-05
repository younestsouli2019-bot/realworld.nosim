import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BACKUP_DIR = path.join(process.cwd(), 'doomsday-vault');
const LEDGER_PATH = path.join(process.cwd(), 'src', 'real', 'ledger');
const OFFLINE_STORE = path.join(process.cwd(), '.base44-offline-store.json');
const MISSIONS_DIR = path.join(process.cwd(), 'missions'); // Check if exists
const MIGRATION_DIR = path.join(process.cwd(), 'migrate'); // Important logic

export async function runDoomsdayExport() {
    console.log("☢️ INITIATING DOOMSDAY LEDGER EXPORT ☢️");

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destDir = path.join(BACKUP_DIR, `ledger-dump-${timestamp}`);
    fs.mkdirSync(destDir);

    // 1. Copy Offline Store
    if (fs.existsSync(OFFLINE_STORE)) {
        fs.copyFileSync(OFFLINE_STORE, path.join(destDir, 'base44-offline-store.json'));
        console.log(`   - Offline Store secured.`);
    }

    // 2. Copy Execution History & Failures
    if (fs.existsSync(LEDGER_PATH)) {
        // Recursive copy manually or via shell if lazy, but let's do simple file copy for known files
        const files = fs.readdirSync(LEDGER_PATH);
        for (const f of files) {
            if (f.endsWith('.json') || f.endsWith('.mjs')) {
                 fs.copyFileSync(path.join(LEDGER_PATH, f), path.join(destDir, f));
            }
        }
        console.log(`   - Ledger History secured.`);
    }

    // 3. Copy Agent Artifacts/Missions (Proof of Work)
    if (fs.existsSync(MISSIONS_DIR)) {
        const missionDest = path.join(destDir, 'missions');
        fs.mkdirSync(missionDest);
        // Deep copy needed? Let's do top level for now or recursive if simple
        try {
             fs.cpSync(MISSIONS_DIR, missionDest, { recursive: true });
             console.log(`   - Mission Artifacts secured.`);
        } catch (e) {
             console.warn(`   - Mission Artifacts copy failed: ${e.message}`);
        }
    }

    // 4. Copy Migration Data (Pending Settlements)
    if (fs.existsSync(MIGRATION_DIR)) {
        const migDest = path.join(destDir, 'migrate');
        fs.mkdirSync(migDest);
        try {
             fs.cpSync(MIGRATION_DIR, migDest, { recursive: true });
             console.log(`   - Migration/Settlement Data secured.`);
        } catch (e) {
             console.warn(`   - Migration Data copy failed: ${e.message}`);
        }
    }

    // 5. Create a README
    const readme = `
DOOMSDAY LEDGER EXPORT
======================
Generated: ${timestamp}

This folder contains a snapshot of the autonomous agent's financial memory.
If the platform is censored or the server is unreachable, use these files 
to reconstruct the revenue history and unpaid obligations.

- base44-offline-store.json: The local database of revenue events.
- execution_history.json: The log of what the agent tried to do.
- missions/: Artifacts and work products created by the agents.
- migrate/: Pending settlements and bank wire batches.

TO RESTORE:
1. Place base44-offline-store.json in the project root.
2. Set BASE44_OFFLINE=true env var.
3. Run the daemon.
    `;
    fs.writeFileSync(path.join(destDir, 'README.txt'), readme);

    console.log(`✅ Doomsday Export Complete: ${destDir}`);
    return destDir;
}

// Allow direct run
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runDoomsdayExport();
}
