import fs from 'fs';
import path from 'path';
import { recordAttempt } from '../ledger/history.mjs';

const HISTORY_PATH = path.join(process.cwd(), 'src', 'real', 'ledger', 'execution_history.json');
const CULLED_PATH = path.join(process.cwd(), 'src', 'real', 'ledger', 'culled_missions.json');
const LIVE_OFFERS_PATH = path.join(process.cwd(), 'LIVE_OFFERS.md');
const GRACE_PATH = path.join(process.cwd(), 'src', 'real', 'ledger', 'grace_extensions.json');

function loadJson(p) {
    if (!fs.existsSync(p)) return [];
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

export function enforceSla() {
    console.log("👮 STARTING SLA ENFORCEMENT: 30-DAY OUTPUT OR CULL");
    
    const history = loadJson(HISTORY_PATH);
    const culled = loadJson(CULLED_PATH);
    const grace = loadJson(GRACE_PATH);
    const now = new Date();
    const baseDays = Number(process.env.SLA_BASE_DAYS ?? 30);
    const graceDays = Number(process.env.SLA_GRACE_DAYS ?? 14);
    const recentWindowDays = Number(process.env.SLA_RECENT_ACTIVITY_DAYS ?? 10);
    const enableGrace = String(process.env.SLA_ENABLE_GRACE ?? "true").toLowerCase() === "true";
    const BASE_MS = baseDays * 24 * 60 * 60 * 1000;
    const RECENT_MS = recentWindowDays * 24 * 60 * 60 * 1000;

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
        if (stats.success) continue;
        if (!stats.started) continue;

        const ageMs = now - stats.started;
        if (ageMs > BASE_MS) {
            if (culled.includes(id)) continue;
            let recentActivity = false;
            let activityCount = 0;
            for (const e of history) {
                if (e.idea_id !== id) continue;
                const t = new Date(e.timestamp);
                if (now - t <= RECENT_MS) {
                    if (e.status === 'STARTED' || e.status === 'FAILED') {
                        recentActivity = true;
                        activityCount++;
                    }
                }
            }
            let environmentFavorable = false;
            try {
                const railStatsPath = path.join(process.cwd(), 'data', 'rail-stats.json');
                if (fs.existsSync(railStatsPath)) {
                    const statsObj = JSON.parse(fs.readFileSync(railStatsPath, 'utf8'));
                    const rails = Object.values(statsObj || {});
                    const totals = rails.map(r => (r.success || 0) + (r.failure || 0));
                    const failures = rails.map(r => (r.failure || 0));
                    const sumT = totals.reduce((a,b)=>a+b,0);
                    const sumF = failures.reduce((a,b)=>a+b,0);
                    const rate = sumT > 0 ? (sumF / sumT) : 0.0;
                    environmentFavorable = rate < 0.2;
                }
            } catch {}
            const contingency = String(process.env.REGULATORY_CONTINGENCY_ACTIVE ?? "false").toLowerCase() === "true";
            const eligibleForGrace = enableGrace && (recentActivity || activityCount >= 2 || environmentFavorable || contingency);
            if (eligibleForGrace) {
                const until = new Date(stats.started.getTime() + (BASE_MS + graceDays * 24 * 60 * 60 * 1000)).toISOString();
                const already = Array.isArray(grace) && grace.find(x => x?.id === id);
                if (!already) {
                    grace.push({ id, extendedUntil: until, baseDays, graceDays, recentActivity, activityCount, environmentFavorable, contingency });
                    fs.writeFileSync(GRACE_PATH, JSON.stringify(grace, null, 2));
                    recordAttempt({ idea_id: id, status: 'GRACE_EXTENDED', reason: `Extended by ${graceDays} days` });
                    console.log(`🟡 Grace extended for ${id} by ${graceDays} days`);
                } else {
                    console.log(`🟡 Grace already recorded for ${id}`);
                }
                continue;
            }
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
