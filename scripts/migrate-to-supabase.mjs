import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load Env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env");
    console.log("   Please set these variables to run the migration.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATA_DIR = path.join(__dirname, '../data');

async function migrateCollection(dirName, tableName) {
    const dirPath = path.join(DATA_DIR, dirName);
    if (!fs.existsSync(dirPath)) {
        console.log(`⚠️  Directory ${dirName} not found. Skipping.`);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    console.log(`\n📦 Migrating ${files.length} items from ${dirName} to ${tableName}...`);

    let success = 0;
    let failed = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
            const data = JSON.parse(content);

            // Normalize data for SQL if needed (e.g. date fields)
            // This assumes the JSON structure matches the table columns roughly
            // For 'events', we might need to map fields.
            
            const { error } = await supabase
                .from(tableName)
                .upsert(data, { onConflict: 'id' });

            if (error) {
                console.error(`   ❌ Failed to migrate ${file}: ${error.message}`);
                failed++;
            } else {
                process.stdout.write('.');
                success++;
            }
        } catch (e) {
            console.error(`   ❌ Error reading ${file}: ${e.message}`);
            failed++;
        }
    }
    console.log(`\n   ✅ Finished ${tableName}: ${success} synced, ${failed} failed.`);
}

async function run() {
    console.log("🚀 STARTING SUPABASE MIGRATION");
    console.log("==============================");

    await migrateCollection('events', 'revenue_events');
    await migrateCollection('recipients', 'recipients');
    await migrateCollection('payouts', 'payouts');
    
    // Audit logs might be too large, maybe migrate only recent?
    // await migrateCollection('audit', 'audit_logs');

    console.log("\n✅ MIGRATION COMPLETE");
}

run().catch(console.error);
