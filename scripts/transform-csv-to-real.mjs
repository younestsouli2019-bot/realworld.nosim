import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ARCHIVE_DIR = path.join(ROOT_DIR, 'archive');

// Simple CSV parser
function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    
    const headers = parseLine(lines[0]);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        if (values.length === headers.length) {
            const obj = {};
            headers.forEach((h, index) => {
                obj[h] = values[index];
            });
            results.push(obj);
        }
    }
    return results;
}

function parseLine(line) {
    const values = [];
    let current = '';
    let inQuote = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuote && line[i+1] === '"') {
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

// Map CSV files to handlers
const HANDLERS = {
    'Analytics_export': handleAnalytics,
    'Mission_export': handleMissions
};

async function main() {
    console.log("🚀 STARTING TRANSFORMATION: CSV -> REAL EXECUTION");
    
    // Scan both ARCHIVE_DIR and ROOT_DIR
    const archiveFiles = fs.existsSync(ARCHIVE_DIR) 
        ? fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.csv')).map(f => path.join(ARCHIVE_DIR, f))
        : [];
        
    const rootFiles = fs.readdirSync(ROOT_DIR)
        .filter(f => f.endsWith('.csv') && (f.startsWith('Analytics_export') || f.startsWith('Mission_export')))
        .map(f => path.join(ROOT_DIR, f));
        
    const allFiles = [...archiveFiles, ...rootFiles];
    console.log(`Found ${allFiles.length} CSV files to process.`);
    
    for (const fullPath of allFiles) {
        const file = path.basename(fullPath);
        let handled = false;
        for (const [prefix, handler] of Object.entries(HANDLERS)) {
            if (file.startsWith(prefix)) {
                console.log(`\nProcessing ${file}...`);
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const records = parseCSV(content);
                    await handler(records, file);
                } catch (err) {
                    console.error(`Error processing ${file}:`, err.message);
                }
                handled = true;
                break;
            }
        }
    }
}

async function handleAnalytics(records, filename) {
    console.log(`Found ${records.length} analytics records.`);
    
    const revenueEvents = records.filter(r => r.metric_type === 'revenue');
    const otherMetrics = records.filter(r => r.metric_type !== 'revenue');
    
    console.log(`-> ${revenueEvents.length} are REVENUE events.`);
    console.log(`-> ${otherMetrics.length} are OTHER metrics (traffic, conversions, etc.).`);
    
    // Process Other Metrics (Save for future use)
    if (otherMetrics.length > 0) {
        const metricsPath = path.join(ROOT_DIR, 'data', 'metrics-ingested.json');
        let existingMetrics = [];
        if (fs.existsSync(metricsPath)) {
            existingMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
        }
        
        const newMetrics = otherMetrics.map(r => ({
            id: r.id,
            type: r.metric_type,
            value: parseFloat(r.value),
            date: new Date(r.date).toISOString(),
            source: r.source_platform,
            agent_id: r.agent_id,
            legacy_file: filename,
            is_suspended: (r.source_platform && r.source_platform.toLowerCase().includes('udemy')) || (r.target_url && r.target_url.toLowerCase().includes('udemy'))
        })).filter(m => !existingMetrics.find(x => x.id === m.id));
        
        if (newMetrics.length > 0) {
            fs.writeFileSync(metricsPath, JSON.stringify([...existingMetrics, ...newMetrics], null, 2));
            console.log(`✅ Saved ${newMetrics.length} new metrics to data/metrics-ingested.json`);
        }
    }
    
    // Transform to Real RevenueEvents
    const realEvents = revenueEvents.map(r => {
        const hasId = !!r.id && r.id.trim().length > 0;
        return {
            id: hasId ? r.id : null,
            amount: parseFloat(r.value),
            currency: 'USD', // Assumption, verify if column exists
            source: r.source_platform,
            timestamp: new Date(r.date).toISOString(),
            agent_id: r.agent_id,
            status: hasId ? 'confirmed' : 'hallucination', // FORCE STATUS based on ID presence
            legacy_file: filename,
            is_simulated: r.is_sample === 'true',
            is_suspended: (r.source_platform && r.source_platform.toLowerCase().includes('udemy')) || (r.target_url && r.target_url.toLowerCase().includes('udemy')),
            is_hallucination: !hasId
        };
    });

    // Filter out hallucinations and simulated events
    // User says: "No IDs = hallucination." and "Anything else is not revenue."
    const validEvents = realEvents.filter(e => !e.is_simulated && !e.is_hallucination);
    const hallucinations = realEvents.filter(e => e.is_hallucination);

    if (hallucinations.length > 0) {
        console.warn(`⚠️ Found ${hallucinations.length} HALLUCINATIONS (No IDs). Skipping.`);
    }

    console.log(`-> ${validEvents.length} are potentially REAL (valid ID, not is_sample).`);

    if (validEvents.length > 0) {
        // TODO: Save to data/revenue-events-pending.json or similar
        const pendingPath = path.join(ROOT_DIR, 'data', 'revenue-events-ingested.json');
        let existing = [];
        if (fs.existsSync(pendingPath)) {
            existing = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
        }
        // Dedupe
        const newEvents = validEvents.filter(e => !existing.find(x => x.id === e.id));
        if (newEvents.length > 0) {
            fs.writeFileSync(pendingPath, JSON.stringify([...existing, ...newEvents], null, 2));
            console.log(`✅ Saved ${newEvents.length} new revenue events to data/revenue-events-ingested.json`);
        } else {
            console.log("All events already ingested.");
        }
    }
}

async function handleMissions(records, filename) {
    console.log(`Found ${records.length} mission records.`);
    // Transform to Real Missions (Backlog)
    // We need to see if these are "simulated" missions or real ones.
    
    const realMissions = records.map(r => {
        let params = {};
        try { params = JSON.parse(r.mission_parameters || '{}'); } catch (e) {}
        
        // Detect Udemy in title or parameters
        const isUdemy = (r.title && r.title.toLowerCase().includes('udemy')) || 
                        JSON.stringify(params).toLowerCase().includes('udemy');
        
        // Detect SelarBot (Priority Target)
        const isSelar = (r.title && r.title.toLowerCase().includes('selar')) || 
                        JSON.stringify(params).toLowerCase().includes('selar');

        return {
            id: r.id,
            title: r.title,
            status: isUdemy ? 'suspended' : 'todo', // Suspend Udemy missions immediately
      priority: isSelar ? 'high' : r.priority, // Prioritize Selar
      handoff_agent: isSelar ? 'selarbot' : undefined, // Explicitly set handoff agent
      parameters: params,
            legacy_file: filename,
            is_sample: r.is_sample === 'true',
            is_suspended: isUdemy,
            suspension_reason: isUdemy ? 'Udemy account suspended (AI Policy)' : null,
            tags: isSelar ? ['selar', 'priority_target'] : []
        };
    });

    const validMissions = realMissions.filter(m => !m.is_sample);
    console.log(`-> ${validMissions.length} are potentially REAL missions.`);

    if (validMissions.length > 0) {
        const backlogPath = path.join(ROOT_DIR, 'data', 'restored-missions.json');
        let existing = [];
        if (fs.existsSync(backlogPath)) {
            existing = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
            
            // Re-evaluate existing missions for suspension (e.g. Udemy rule)
            let updatedCount = 0;
            existing = existing.map(m => {
                const jsonString = JSON.stringify(m).toLowerCase();
                if (jsonString.includes('udemy') && m.status !== 'suspended') {
                    m.status = 'suspended';
                    m.is_suspended = true;
                    m.suspension_reason = 'Udemy account suspended (AI Policy)';
                    updatedCount++;
                }
                return m;
            });
            if (updatedCount > 0) {
                console.log(`⚠️ Retroactively suspended ${updatedCount} existing missions due to Udemy policy.`);
            }
        }
        const newMissions = validMissions.filter(m => !existing.find(x => x.id === m.id));
        if (newMissions.length > 0) {
            fs.writeFileSync(backlogPath, JSON.stringify([...existing, ...newMissions], null, 2));
            console.log(`✅ Saved ${newMissions.length} new missions to data/restored-missions.json`);
        }
    }
}

main().catch(console.error);
