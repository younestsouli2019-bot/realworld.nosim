import fs from 'fs';
import path from 'path';

/**
 * ConsolidationDashboard
 * 
 * Generates a simple HTML dashboard to visualize mission clusters and efficiency gains.
 */
export class ConsolidationDashboard {
    constructor(outputPath = './data/dashboard.html') {
        this.outputPath = outputPath;
    }

    generate(clusters, stats) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Swarm Consolidation Dashboard</title>
    <style>
        body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
        .card { background: #252526; padding: 15px; margin-bottom: 10px; border-left: 5px solid #007acc; }
        .stat { font-size: 1.2em; color: #4ec9b0; }
        h1 { color: #569cd6; }
    </style>
</head>
<body>
    <h1>🐝 Swarm Consolidation Dashboard</h1>
    
    <div class="card">
        <h2>Efficiency Stats</h2>
        <p>Original Missions: <span class="stat">${stats.originalCount}</span></p>
        <p>Consolidated Clusters: <span class="stat">${stats.clusterCount}</span></p>
        <p>Efficiency Gain: <span class="stat">${stats.efficiencyGain.toFixed(1)}%</span></p>
    </div>

    <h2>Active Clusters</h2>
    ${clusters.map(c => `
        <div class="card">
            <h3>${c.type} (Priority: ${c.priority})</h3>
            <p><strong>Merged Missions:</strong> ${c.missionIds.join(', ')}</p>
            <p><strong>Agents:</strong> ${c.agents.join(', ')}</p>
            <p><strong>Description:</strong> ${c.description}</p>
        </div>
    `).join('')}

    <p><em>Generated at ${new Date().toISOString()}</em></p>
</body>
</html>
        `;

        try {
            const dir = path.dirname(this.outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.outputPath, html);
            console.log(`[Dashboard] Generated at ${this.outputPath}`);
        } catch (e) {
            console.error('[Dashboard] Failed to generate:', e);
        }
    }
}
