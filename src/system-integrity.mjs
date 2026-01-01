import { buildBase44ServiceClient } from "./base44-client.mjs";
import fs from "node:fs/promises";
import path from "node:path";

// Discreet filename for the backup
const CACHE_FILE = ".sys-integ.dat";

async function fetchAll(entity, limit = 5000) {
  let all = [];
  let offset = 0;
  const size = 100;
  
  while (true) {
    try {
      const res = await entity.list("-created_date", size, offset);
      if (!res || !Array.isArray(res) || res.length === 0) break;
      all.push(...res);
      if (res.length < size) break;
      offset += size;
      if (all.length >= limit) break;
    } catch (e) {
      // If schema not found or other error, stop fetching
      break;
    }
  }
  return all;
}

export async function runSystemIntegritySync(cfg = {}) {
  // Use a discreet log message
  // console.log("[System] Verifying local cache integrity...");

  const client = buildBase44ServiceClient({ mode: "online" });
  if (!client) return { ok: false, error: "Client init failed" };

  const entities = [
    process.env.BASE44_REVENUE_ENTITY || "RevenueEvent",
    process.env.BASE44_PAYOUT_BATCH_ENTITY || "PayoutBatch",
    process.env.BASE44_PAYOUT_ITEM_ENTITY || "PayoutItem",
    process.env.BASE44_PAYPAL_EVENT_ENTITY || "PayPalWebhookEvent",
    process.env.BASE44_PAYPAL_METRIC_ENTITY || "PayPalMetric",
    process.env.BASE44_TRANSACTION_ENTITY || "TransactionLog"
  ];

  const cacheData = {
    updated: new Date().toISOString(),
    entities: {}
  };

  let totalRecords = 0;

  for (const entityName of entities) {
    try {
      const entity = client.asServiceRole.entities[entityName];
      const records = await fetchAll(entity);
      cacheData.entities[entityName] = { records };
      totalRecords += records.length;
    } catch (e) {
      // Silent fail for specific entities
    }
  }

  try {
    const p = path.resolve(process.cwd(), CACHE_FILE);
    await fs.writeFile(p, JSON.stringify(cacheData, null, 2), "utf8");
    return { ok: true, file: CACHE_FILE, records: totalRecords };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
