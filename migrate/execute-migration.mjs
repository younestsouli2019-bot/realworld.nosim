
import './env-loader.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

function getPayoutBatchConfig() {
  return {
    entityName: process.env.BASE44_PAYOUT_BATCH_ENTITY ?? "PayoutBatch",
    fieldMap: {
      status: "status",
      submittedAt: "submitted_at",
      notes: "notes"
    }
  };
}

function getPayoutItemConfig() {
  return {
    entityName: process.env.BASE44_PAYOUT_ITEM_ENTITY ?? "PayoutItem",
    fieldMap: {
      status: "status",
      notes: "notes"
    }
  };
}

export async function executeMigration() {
  console.log('🚀 EXECUTING REVENUE MIGRATION');
  
  // Read approved plan
  const planPath = path.join('migrate', 'migration-plan.json');
  if (!fs.existsSync(planPath)) {
      throw new Error("Migration plan not found. Run approve-migration-batches.mjs first.");
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  
  if (!plan.approved) {
    console.error('❌ Migration not approved yet. Run approval first.');
    return;
  }
  
  const client = buildBase44Client();
  
  // Determine execution method based on destination
  const firstBatch = plan.batches[0];
  const destination = firstBatch.destination;
  
  console.log(`🎯 Migration destination: ${destination}`);
  console.log(`💰 Total to migrate: ${plan.totalAmount}`);
  
  // Execute based on destination
  switch(destination) {
    case 'paypal':
      await executePayPalMigration(plan, client);
      break;
    case 'bank':
      await executeBankMigration(plan, client);
      break;
    case 'payoneer':
      await executePayoneerMigration(plan, client);
      break;
    default:
      console.error(`❌ Unknown destination: ${destination}`);
  }
}

async function executePayPalMigration(plan, client) {
  console.log('💸 Executing via PayPal Payouts API');
  
  const batchCfg = getPayoutBatchConfig();
  const itemCfg = getPayoutItemConfig();
  const batchEntity = client.asServiceRole.entities[batchCfg.entityName];
  const itemEntity = client.asServiceRole.entities[itemCfg.entityName];
  
  // Use existing PayPal payout submission
  const batchId = plan.batches[0].batchId;
  const cmd = `npm run emit:revenue -- --submit-batch ${batchId}`;
  console.log(`Running: ${cmd}`);
  
  try {
      const { stdout, stderr } = await execAsync(cmd);
      console.log('PayPal submission output:', stdout);
      
      if (stderr && !stderr.includes('warning') && !stderr.includes('npm WARN')) {
        console.error('PayPal submission error (stderr):', stderr);
      }
      
      // Extract PayPal batch ID from output
      const paypalMatch = stdout.match(/paypal_payout_batch_id["']:\s*["']([^"']+)["']/);
      if (paypalMatch) {
        const paypalBatchId = paypalMatch[1];
        
        // Update all batches with PayPal ID
        for (const batch of plan.batches) {
          await batchEntity.update(batch.batchEntityId, {
            [batchCfg.fieldMap.status]: 'submitted_to_paypal',
            [batchCfg.fieldMap.submittedAt]: new Date().toISOString(),
            [batchCfg.fieldMap.notes]: {
              ...batch.notes,
              paypal_payout_batch_id: paypalBatchId,
              submitted_at: new Date().toISOString()
            }
          });
          
          await itemEntity.update(batch.itemEntityId, {
            [itemCfg.fieldMap.status]: 'submitted',
            notes: {
              ...batch.notes,
              paypal_batch_id: paypalBatchId
            }
          });
        }
        
        console.log(`✅ Submitted to PayPal with batch ID: ${paypalBatchId}`);
      }
  } catch (err) {
      console.error('Failed to execute PayPal migration:', err);
      throw err;
  }
}

async function executeBankMigration(plan, client) {
  console.log('🏦 Executing via Bank Wire Export');
  
  const batchCfg = getPayoutBatchConfig();
  const batchEntity = client.asServiceRole.entities[batchCfg.entityName];

  // Generate bank wire CSV
  const csvContent = generateBankWireCSV(plan);
  const outPath = path.join('migrate', 'bank-wire-export.csv');
  fs.writeFileSync(outPath, csvContent);
  
  console.log(`📄 Bank wire CSV generated: ${outPath}`);
  console.log('\n📋 BANK WIRE INSTRUCTIONS:');
  console.log(`1. Log into your French bank account (Source RIB: ${process.env.SOURCE_ACCOUNT_IBAN || '230780211161400002318873'})`);
  console.log('2. Go to International Transfers');
  console.log('3. Upload this CSV file or manually enter beneficiaries');
  console.log(`4. Beneficiary: ${process.env.OWNER_NAME || 'Younest Souli'}`);
  console.log(`5. Beneficiary IBAN: ${process.env.OWNER_BANK_IBAN || '007810000448500030594182'}`);
  console.log('6. Verify amounts and execute');
  console.log('7. Mark as completed when funds received');
  
  // Update batch status to exported
  for (const batch of plan.batches) {
    await batchEntity.update(batch.batchEntityId, {
      [batchCfg.fieldMap.status]: 'exported_for_bank_wire',
      [batchCfg.fieldMap.notes]: {
        ...batch.notes,
        bank_wire_exported: new Date().toISOString(),
        export_file: 'migrate/bank-wire-export.csv',
        instructions: 'Manual execution required via bank portal'
      }
    });
  }
}

function generateBankWireCSV(plan) {
  // Generate standard bank wire CSV format
  // Format: IBAN,Amount,Currency,Beneficiary Name,Reference
  let csv = 'IBAN,Amount,Currency,Beneficiary Name,Reference\n';
  
  for (const batch of plan.batches) {
    const iban = process.env.OWNER_BANK_IBAN || '007810000448500030594182';
    const name = process.env.OWNER_NAME || 'Younest Souli';
    const reference = `MIGRATION_${batch.batchId}`;
    
    csv += `${iban},${batch.amount},${batch.currency},${name},${reference}\n`;
  }
  
  return csv;
}

async function executePayoneerMigration(plan, client) {
  console.log('🌐 Executing via Payoneer Export');
  
  const batchCfg = getPayoutBatchConfig();
  const batchEntity = client.asServiceRole.entities[batchCfg.entityName];
  
  // Similar to bank wire but for Payoneer
  let csv = 'Payoneer ID,Amount,Currency,Reference\n';
  for (const batch of plan.batches) {
      const pid = process.env.OWNER_PAYONEER_ID;
      const reference = `MIGRATION_${batch.batchId}`;
      csv += `${pid},${batch.amount},${batch.currency},${reference}\n`;
  }
  
  const outPath = path.join('migrate', 'payoneer-export.csv');
  fs.writeFileSync(outPath, csv);
  
  console.log(`📄 Payoneer CSV generated: ${outPath}`);
  
  for (const batch of plan.batches) {
    await batchEntity.update(batch.batchEntityId, {
      [batchCfg.fieldMap.status]: 'exported_for_payoneer',
      [batchCfg.fieldMap.notes]: {
        ...batch.notes,
        payoneer_exported: new Date().toISOString(),
        export_file: 'migrate/payoneer-export.csv'
      }
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  executeMigration().catch(console.error);
}
