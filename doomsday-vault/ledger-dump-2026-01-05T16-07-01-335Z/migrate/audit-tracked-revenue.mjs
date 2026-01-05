
import './env-loader.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';
import fs from 'fs';
import path from 'path';

// Helper to list all records
async function listAll(entity, { fields = null, pageSize = 200, sort = "-created_date" } = {}) {
  const out = [];
  let offset = 0;
  for (;;) {
    const page = await entity.list(sort, pageSize, offset, fields ?? undefined);
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return out;
}

export async function auditTrackedRevenue() {
  console.log('🔍 AUDITING TRACKED REVENUE');
  
  const client = buildBase44Client();
  if (!client) {
      throw new Error("Failed to initialize Base44 client. Check environment variables.");
  }
  
  const revenueCfg = getRevenueConfigFromEnv();
  const revenueEntity = client.asServiceRole.entities[revenueCfg.entityName];
  
  // 1. Query ALL RevenueEvents
  console.log(`Fetching all ${revenueCfg.entityName} records...`);
  const revenueEvents = await listAll(revenueEntity, {
    fields: [
        revenueCfg.fieldMap.amount,
        revenueCfg.fieldMap.currency,
        revenueCfg.fieldMap.status,
        revenueCfg.fieldMap.payoutBatchId,
        revenueCfg.fieldMap.occurredAt,
        revenueCfg.fieldMap.source,
        'id'
    ]
  });
  
  console.log(`Found ${revenueEvents.length} events.`);

  // 2. Group by status
  const byStatus = revenueEvents.reduce((acc, event) => {
    const status = event[revenueCfg.fieldMap.status] || 'unknown';
    acc[status] = acc[status] || { count: 0, total: 0, events: [] };
    acc[status].count++;
    acc[status].total += parseFloat(event[revenueCfg.fieldMap.amount] || 0);
    acc[status].events.push(event);
    return acc;
  }, {});
  
  // 3. Calculate totals
  const totalTracked = revenueEvents.reduce((sum, e) => sum + parseFloat(e[revenueCfg.fieldMap.amount] || 0), 0);
  
  const unpaid = revenueEvents.filter(e => {
    const status = e[revenueCfg.fieldMap.status];
    const payoutBatchId = e[revenueCfg.fieldMap.payoutBatchId];
    return !payoutBatchId && 
           status !== 'paid_out' && 
           status !== 'refunded' &&
           status !== 'cancelled'; // Exclude cancelled if any
  });
  
  // 4. Generate report
  const report = {
    auditDate: new Date().toISOString(),
    totalRevenueEvents: revenueEvents.length,
    totalTrackedAmount: totalTracked,
    byStatus,
    unpaidRevenue: {
      count: unpaid.length,
      total: unpaid.reduce((sum, e) => sum + parseFloat(e[revenueCfg.fieldMap.amount] || 0), 0),
      events: unpaid.map(e => ({
        id: e.id,
        amount: e[revenueCfg.fieldMap.amount],
        currency: e[revenueCfg.fieldMap.currency],
        occurred_at: e[revenueCfg.fieldMap.occurredAt],
        source: e[revenueCfg.fieldMap.source]
      }))
    }
  };
  
  // Save report
  const outDir = 'migrate';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  
  fs.writeFileSync(path.join(outDir, 'audit-report.json'), JSON.stringify(report, null, 2));
  console.log('📊 Audit saved: migrate/audit-report.json');
  console.log(`💰 Unpaid Revenue: ${report.unpaidRevenue.count} events, Total: ${report.unpaidRevenue.total.toFixed(2)}`);
  
  return report;
}

// Run audit
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  auditTrackedRevenue().catch(console.error);
}
