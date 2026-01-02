import { buildBase44Client } from './src/base44-client.mjs';
import './src/load-env.mjs';

async function check() {
  console.log("Checking Base44 Connectivity...");
  try {
    const client = buildBase44Client();
    console.log("Client built.");
    
    const entityName = process.env.BASE44_REVENUE_EVENT_ENTITY || "RevenueEvent";
    console.log(`Fetching ${entityName}...`);
    
    const rows = await client.asServiceRole.entities[entityName].list("-created_date", 1);
    console.log("✅ SUCCESS! Connectivity verified.");
    console.log(`Found ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log("Sample:", rows[0]);
    } else {
      console.log("Table is empty (but accessible).");
    }
  } catch (e) {
    console.error("❌ FAILED:", e.message);
    if (e.message.includes("403")) {
      console.error("still seeing 403 Forbidden - did you save the Privacy setting?");
    }
  }
}

check();
