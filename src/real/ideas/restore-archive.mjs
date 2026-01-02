import fs from 'fs';
import path from 'path';

// Parse CSV line ensuring we handle quoted strings correctly
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

export async function restoreArchivedMissions() {
    const archivePath = path.join(process.cwd(), 'archive');
    const files = fs.readdirSync(archivePath).filter(f => f.startsWith('Mission_export') && f.endsWith('.csv'));
    
    // Sort to get latest
    files.sort((a, b) => {
        const numA = parseInt(a.match(/\((\d+)\)/)?.[1] || 0);
        const numB = parseInt(b.match(/\((\d+)\)/)?.[1] || 0);
        return numB - numA;
    });

    if (files.length === 0) {
        console.log("No mission exports found in archive.");
        return [];
    }

    const latestFile = path.join(archivePath, files[0]);
    console.log(`Reading archived missions from: ${files[0]}`);

    const content = fs.readFileSync(latestFile, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    
    // Headers: title,type,priority,status,assigned_agent_ids,mission_parameters,progress_data,estimated_duration_hours,actual_duration_hours,deadline,completion_notes,revenue_generated,id,...
    // Indices: title=0, type=1, status=3, revenue_generated=11, id=12
    
    const restored = [];
    
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 13) continue;

        const title = cols[0];
        const type = cols[1];
        const status = cols[3];
        const revenueStr = cols[11];
        const id = cols[12];

        const revenue = parseFloat(revenueStr) || 0;

        // Filter for high potential or already revenue generating
        if (revenue > 0 || status === 'pending' || status === 'deployed') {
            restored.push({
                id: id,
                name: title,
                category: type === 'marketing' ? 'Digital Service' : 'Digital Product',
                verdict: 'TARGET (Restored)',
                selectionScore: 0.95, // High score for restored items
                restored_revenue_potential: revenue
            });
        }
    }

    console.log(`Restored ${restored.length} missions from archive.`);
    
    const outPath = path.join(process.cwd(), 'data', 'archive-restored-ideas.json');
    fs.writeFileSync(outPath, JSON.stringify(restored, null, 2));
    
    return restored;
}

// Run if called directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    restoreArchivedMissions();
}
