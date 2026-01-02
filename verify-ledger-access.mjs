import './src/load-env.mjs';
import { buildBase44Client } from './src/base44-client.mjs';

async function main() {
    console.log("🔍 Verifying Base44 Connectivity & Ledger Access...");
    
    // Force Online explicitly to verify real connectivity
    // We modify the environment for this process only
    process.env.BASE44_OFFLINE = "false"; 
    
    const client = buildBase44Client();
    if (!client) {
        console.error("❌ Failed to build client. Check BASE44_APP_ID and BASE44_SERVICE_TOKEN.");
        return;
    }

    try {
        console.log("   Fetching RevenueEvents (Online Mode)...");
        // Using list to see what we get
        const events = await client.asServiceRole.entities.RevenueEvent.list("-created_date", 5);
        
        console.log(`✅ Success! Retrieved ${events.length} events.`);
        if (events.length > 0) {
            console.log("   First event sample:", JSON.stringify(events[0], null, 2));
        } else {
            console.log("   (No events found, but connection works)");
        }
        
    } catch (e) {
        console.error("❌ Error fetching events:", e.message);
        if (e.message.includes("403")) {
            console.error("   -> 403 Forbidden: Ensure App is PUBLIC/UNLISTED and Token matches App ID.");
        }
    }
}

main();
