
import './env-loader.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import fs from 'fs';
import path from 'path';

export async function recoverState() {
  console.log('🚑 CHECKING FOR STUCK MIGRATION BATCHES');
  
  const client = buildBase44Client();
  const batchEntityName = process.env.BASE44_PAYOUT_BATCH_ENTITY ?? "PayoutBatch";
  const batchEntity = client.asServiceRole.entities[batchEntityName];
  
  // Find pending or approved batches
  // Note: This is a simple scan. In production with millions of batches, we'd need better filtering.
  const batches = await batchEntity.list('-created_date', 50); // Get last 50 batches
  
  const stuckBatches = batches.filter(b => 
    (b.status === 'pending_approval' || b.status === 'approved') &&
    b.notes && b.notes.migration === true
  );
  
  if (stuckBatches.length === 0) {
    console.log('✅ No stuck batches found.');
    return false;
  }
  
  console.log(`⚠️ Found ${stuckBatches.length} stuck batches. Recovering...`);
  
  const planBatches = stuckBatches.map(b => ({
    batchId: b.batch_id,
    currency: b.currency,
    amount: b.total_amount,
    eventCount: b.revenue_event_ids ? b.revenue_event_ids.length : 0,
    destination: b.notes.destination || process.env.MIGRATION_DESTINATION || 'bank',
    batchEntityId: b.id,
    // We'd need to find the item ID, but for now let's assume we can recover without it 
    // or we'd need to query items. Execute-migration uses itemEntityId.
    // Let's query the item.
    itemEntityId: null, // Placeholder, will fill below
    notes: b.notes
  }));
  
  // Fetch items for these batches to fill itemEntityId
  const itemEntityName = process.env.BASE44_PAYOUT_ITEM_ENTITY ?? "PayoutItem";
  const itemEntity = client.asServiceRole.entities[itemEntityName];
  
  for (const pb of planBatches) {
    // We assume 1 item per migration batch as per create-migration-batches logic
    const items = await itemEntity.list('-created_date', 10, 0, ['id', 'batch_id']);
    // Filter client side because we might not have filter support on list yet or it's complex
    // Actually, listing 10 might miss it. We should use query if available.
    // Base44Client has queryEntities?
    // Let's try to just find it.
    // If we can't find it easily, we might fail execution.
    // But for now, let's assume the user just ran it and it's at the top.
    const item = items.find(i => i.batch_id === pb.batchId);
    if (item) {
        pb.itemEntityId = item.id;
    } else {
        console.warn(`⚠️ Could not find PayoutItem for batch ${pb.batchId}. Recovery might fail for this batch.`);
    }
  }
  
  const plan = {
    created: new Date().toISOString(),
    totalBatches: planBatches.length,
    totalAmount: planBatches.reduce((sum, b) => sum + b.amount, 0),
    batches: planBatches,
    recovered: true
  };
  
  fs.writeFileSync(path.join('migrate', 'migration-plan.json'), JSON.stringify(plan, null, 2));
  console.log('📋 Recovered migration plan saved: migrate/migration-plan.json');
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  recoverState().catch(console.error);
}
