
import './env-loader.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';
import fs from 'fs';
import path from 'path';

function getPayoutBatchConfig() {
  return {
    entityName: process.env.BASE44_PAYOUT_BATCH_ENTITY ?? "PayoutBatch",
    fieldMap: {
      batchId: "batch_id",
      totalAmount: "total_amount",
      currency: "currency",
      status: "status",
      revenueEventIds: "revenue_event_ids",
      earningIds: "earning_ids",
      notes: "notes",
      approvedAt: "approved_at",
      submittedAt: "submitted_at"
    }
  };
}

function getPayoutItemConfig() {
  return {
    entityName: process.env.BASE44_PAYOUT_ITEM_ENTITY ?? "PayoutItem",
    fieldMap: {
      itemId: "item_id",
      batchId: "batch_id",
      recipient: "recipient",
      recipientType: "recipient_type",
      amount: "amount",
      currency: "currency",
      status: "status",
      revenueEventIds: "revenue_event_ids",
      notes: "notes"
    }
  };
}

export async function createMigrationBatches() {
  console.log('🚀 CREATING MIGRATION BATCHES FOR TRACKED REVENUE');
  
  // Read audit
  const auditPath = path.join('migrate', 'audit-report.json');
  if (!fs.existsSync(auditPath)) {
      throw new Error("Audit report not found. Run audit-tracked-revenue.mjs first.");
  }
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  
  if (audit.unpaidRevenue.count === 0) {
    console.log('✅ No unpaid revenue to migrate');
    return;
  }
  
  console.log(`📦 Creating batches for ${audit.unpaidRevenue.count} unpaid revenue events`);
  
  // Group by currency for separate batches
  const byCurrency = {};
  audit.unpaidRevenue.events.forEach(event => {
    const currency = event.currency || 'USD';
    byCurrency[currency] = byCurrency[currency] || [];
    byCurrency[currency].push(event);
  });
  
  const client = buildBase44Client();
  const batchCfg = getPayoutBatchConfig();
  const itemCfg = getPayoutItemConfig();
  
  const batchEntity = client.asServiceRole.entities[batchCfg.entityName];
  const itemEntity = client.asServiceRole.entities[itemCfg.entityName];
  
  const batches = [];
  
  // Create batch per currency
  for (const [currency, events] of Object.entries(byCurrency)) {
    const batchId = `MIGRATION_${currency}_${Date.now()}`;
    const totalAmount = events.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    console.log(`💰 Creating ${currency} batch: ${totalAmount.toFixed(2)} ${currency} (${events.length} events)`);
    
    // Create PayoutBatch
    const batchData = {
      [batchCfg.fieldMap.batchId]: batchId,
      [batchCfg.fieldMap.totalAmount]: Number(totalAmount.toFixed(2)),
      [batchCfg.fieldMap.currency]: currency,
      [batchCfg.fieldMap.status]: 'pending_approval',
      [batchCfg.fieldMap.revenueEventIds]: events.map(e => e.id),
      [batchCfg.fieldMap.earningIds]: [],
      [batchCfg.fieldMap.notes]: {
        migration: true,
        source_audit: audit.auditDate,
        original_tracked_total: audit.totalTrackedAmount,
        batch_type: 'tracked_revenue_migration'
      }
    };
    
    const batch = await batchEntity.create(batchData);
    
    // Create PayoutItem (to YOUR account)
    // Determine destination from env
    const ownerDestination = process.env.MIGRATION_DESTINATION || 
                            (process.env.OWNER_BANK_IBAN ? 'bank' : 
                            process.env.OWNER_PAYPAL_EMAIL ? 'paypal' : 
                            process.env.OWNER_PAYONEER_ID ? 'payoneer' : 'unknown');
    
    let recipientValue = null;
    if (ownerDestination === 'bank') recipientValue = process.env.OWNER_BANK_IBAN;
    else if (ownerDestination === 'paypal') recipientValue = process.env.OWNER_PAYPAL_EMAIL;
    else if (ownerDestination === 'payoneer') recipientValue = process.env.OWNER_PAYONEER_ID;
    
    if (!recipientValue) {
        console.warn(`⚠️ Warning: No recipient value found for destination type ${ownerDestination}. Check environment variables.`);
    }

    const payoutItemData = {
      [itemCfg.fieldMap.itemId]: `${batchId}_ITEM_001`,
      [itemCfg.fieldMap.batchId]: batchId,
      [itemCfg.fieldMap.recipient]: recipientValue,
      [itemCfg.fieldMap.recipientType]: ownerDestination,
      [itemCfg.fieldMap.amount]: Number(totalAmount.toFixed(2)),
      [itemCfg.fieldMap.currency]: currency,
      [itemCfg.fieldMap.status]: 'pending',
      [itemCfg.fieldMap.revenueEventIds]: events.map(e => e.id),
      [itemCfg.fieldMap.notes]: {
        migration_batch: true,
        destination: 'owner_account',
        original_events_count: events.length
      }
    };
    
    const payoutItem = await itemEntity.create(payoutItemData);

    // CRITICAL: Update RevenueEvents to link to this batch so they aren't picked up again
    const revenueEntity = client.asServiceRole.entities['RevenueEvent'];
    console.log(`🔗 Linking ${events.length} revenue events to batch ${batchId}...`);
    
    for (const event of events) {
      await revenueEntity.update(event.id, {
        payout_batch_id: batchId,
        status: 'processing'
      });
    }
    
    batches.push({
      batchId,
      currency,
      amount: totalAmount,
      eventCount: events.length,
      destination: ownerDestination,
      batchEntityId: batch.id,
      itemEntityId: payoutItem.id,
      notes: batchData[batchCfg.fieldMap.notes]
    });
    
    console.log(`✅ Created ${currency} batch ${batchId}`);
  }
  
  // Save migration plan
  const migrationPlan = {
    created: new Date().toISOString(),
    totalBatches: batches.length,
    totalAmount: batches.reduce((sum, b) => sum + b.amount, 0),
    batches: batches,
    auditReference: audit.auditDate
  };
  
  fs.writeFileSync(path.join('migrate', 'migration-plan.json'), JSON.stringify(migrationPlan, null, 2));
  console.log('📋 Migration plan saved: migrate/migration-plan.json');
  
  return migrationPlan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createMigrationBatches().catch(console.error);
}
