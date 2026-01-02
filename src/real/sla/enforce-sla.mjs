import fs from 'fs';
import path from 'path';
import { recordAttempt } from '../ledger/history.mjs';

const HISTORY_PATH = path.join(process.cwd(), 'src', 'real', 'ledger', 'execution_history.json');
const CULLED_PATH = path.join(process.cwd(), 'src', 'real', 'ledger', 'culled_missions.json');
const LIVE_OFFERS_PATH = path.join(process.cwd(), 'LIVE_OFFERS.md');

function loadJson(p) {
    if (!fs.existsSync(p)) return [];
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

export function enforceSla() {
    console.log("👮 STARTING SLA ENFORCEMENT: 30-DAY OUTPUT OR CULL");
    
    const history = loadJson(HISTORY_PATH);
    const culled = loadJson(CULLED_PATH);
    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    // Group by Idea
    const ideas = {};
    for (const entry of history) {
        if (!ideas[entry.idea_id]) ideas[entry.idea_id] = { started: null, success: false };
        
        if (entry.status === 'STARTED') {
            const t = new Date(entry.timestamp);
            if (!ideas[entry.idea_id].started || t < ideas[entry.idea_id].started) {
                ideas[entry.idea_id].started = t;
            }
        }
        if (entry.status === 'SUCCESS') {
            ideas[entry.idea_id].success = true;
        }
    }

    const toCull = [];

    for (const [id, stats] of Object.entries(ideas)) {
        if (stats.success) continue; // It made money, it lives.
        if (!stats.started) continue; // Never started?

        const ageMs = now - stats.started;
        if (ageMs > THIRTY_DAYS_MS) {
            // Check if already culled
            if (culled.includes(id)) continue;
            
            toCull.push({ id, ageDays: Math.floor(ageMs / (24*60*60*1000)) });
        }
    }

    if (toCull.length === 0) {
        console.log("✅ No agents violated the 30-day SLA.");
        return;
    }

    console.log(`💀 CULLING ${toCull.length} ZOMBIE AGENTS (No output > 30 days)`);
    
    let offersContent = "";
    if (fs.existsSync(LIVE_OFFERS_PATH)) {
        offersContent = fs.readFileSync(LIVE_OFFERS_PATH, 'utf8');
    }

    for (const zombie of toCull) {
        console.log(`   - Culling ${zombie.id} (Age: ${zombie.ageDays} days)`);
        culled.push(zombie.id);
        
        // Record in history
        recordAttempt({ 
            idea_id: zombie.id, 
            status: 'CULLED', 
            reason: `SLA_VIOLATION: No output for ${zombie.ageDays} days` 
        });

        // Mark in LIVE_OFFERS.md
        // We look for the line: "**Ref:** `OFFER_<id>_...`"
        // And we find the preceding "**Status:** LIVE"
        // This is a bit tricky with regex, so we'll do a simple string search/replace loop if possible
        // But the Ref is after the Status.
        // We can just find the Ref line, then look backwards for "**Status:** LIVE"
        
        // Alternative: Just append a "CULLED" list to the end of the file.
        // Or simpler: We can't easily edit the MD structurally without a parser.
        // Let's just log it for now. The file is for humans.
    }

    fs.writeFileSync(CULLED_PATH, JSON.stringify(culled, null, 2));
    console.log("🗑️ Cull complete.");
}

// Allow direct run
// Check if running directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    enforceSla();
}
