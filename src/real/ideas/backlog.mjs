import fs from 'fs';
import path from 'path';
import { hasBeenAttempted } from '../ledger/history.mjs';

export async function getIdeaBacklog() {
    const reportPath = path.join(process.cwd(), 'data', 'revenue-report-latest.json');
    const archivePath = path.join(process.cwd(), 'data', 'archive-restored-ideas.json');
    
    let allItems = [];

    // 1. Load latest revenue report
    if (fs.existsSync(reportPath)) {
        try {
            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            allItems = allItems.concat(report);
        } catch (e) {
            console.error("❌ Failed to parse revenue report:", e);
        }
    }

    // 2. Load restored archive items
    if (fs.existsSync(archivePath)) {
        try {
            const restored = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
            allItems = allItems.concat(restored);
        } catch (e) {
            console.error("❌ Failed to parse restored archive:", e);
        }
    }

    if (allItems.length === 0) {
         console.warn("⚠️ No ideas found. Run 'node src/real/ideas/restore-archive.mjs' or 'node src/revenue/swarm-runner.mjs'.");
         return [];
    }

    // Filter for "Actionable" ideas AND not attempted
    const filtered = allItems.filter(p => {
        if (hasBeenAttempted(p.id)) return false; // Skip if already tried

        const isTarget = p.verdict && (p.verdict.startsWith('TARGET') || p.verdict.startsWith('Niche'));
        const isHighScore = p.selectionScore > 0.6;
        return isTarget || isHighScore;
    });

    console.log(`   [Backlog] Total items: ${allItems.length}, After Filter: ${filtered.length}`);

    return filtered.map(p => ({
            id: p.id,
            title: p.name,
            description: `Autonomous product: ${p.name}`,
            price_usd: calculatePrice(p),
            category: p.category,
            verdict: p.verdict,
            score: p.selectionScore
        }));
}

function calculatePrice(product) {
    // Simple logic: Base price $20 + some margin logic or random
    // If it's a "Case" -> $25-35
    // If it's a "Mug" -> $15-25
    // If it's digital -> $10-50
    const name = product.name.toLowerCase();
    if (name.includes('case')) return 29.99;
    if (name.includes('mug')) return 19.99;
    if (name.includes('tote')) return 24.99;
    if (name.includes('pack') || name.includes('kit')) return 49.99; // Digital packs
    return 19.99; // Default
}
