
import './env-loader.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';
import { RevenueScoringEngine } from '../src/game/RevenueScoringEngine.mjs';
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
  const scoringEngine = new RevenueScoringEngine();

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
      
      // GAMIFICATION: Score the migration effort
      try {
          for (const batch of plan.batches) {
              await scoringEngine.scoreTransaction({
                  id: batch.batchId,
                  amount_usd: batch.amount, // Assuming USD base
                  currency: batch.currency,
                  provider: 'bank_transfer',
                  provider_confirmation: true, // Manual confirmation assumed for export
                  destination_account: process.env.OWNER_BANK_IBAN || 'BANK_ACCOUNT_IBAN',
                  description: 'Migration Batch Export',
                  customer_email: 'migration@system.internal',
                  involved_agents: ['migration_agent', 'revenue_scoring_agent']
              });
          }
      } catch (err) {
          console.warn("⚠️ Scoring failed (non-critical):", err.message);
      }
      break;
    case 'payoneer':
      await executePayoneerMigration(plan, client);
      break;
    case 'payoneer_bank':
      await executePayoneerBankMigration(plan, client);
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
    const updateData = {
      [batchCfg.fieldMap.status]: 'exported_for_bank_wire',
      [batchCfg.fieldMap.notes]: {
        ...batch.notes,
        bank_wire_exported: new Date().toISOString(),
        export_file: 'migrate/bank-wire-export.csv',
        instructions: 'Manual execution required via bank portal'
      }
    };

    if (batch.local) {
        console.log(`📝 Updating LOCAL batch ${batch.batchId} status...`);
        try {
            // Update local file in migrate/batches/
            const localBatchPath = path.join('migrate', 'batches', `${batch.batchId}.json`);
            if (fs.existsSync(localBatchPath)) {
                const localBatch = JSON.parse(fs.readFileSync(localBatchPath, 'utf8'));
                // Merge update
                Object.assign(localBatch, updateData); // Simple merge, might need field mapping adjustment if keys differ
                // Actually fieldMap keys are likely used in local batch too if created by create-migration-batches
                // Let's check create-migration-batches.mjs: it uses batchCfg.fieldMap keys.
                // So we can just merge.
                // But wait, create-migration-batches uses [batchCfg.fieldMap.status] keys.
                // So updateData keys are correct.
                
                // Also update the fields directly on localBatch
                for (const [key, val] of Object.entries(updateData)) {
                    localBatch[key] = val;
                }
                
                fs.writeFileSync(localBatchPath, JSON.stringify(localBatch, null, 2));
                console.log(`✅ Local batch updated: ${localBatchPath}`);
            } else {
                 console.warn(`⚠️ Local batch file not found: ${localBatchPath}`);
            }
            
            // Also update the approved batch in migrate/approved/ if it exists there
            const approvedPath = path.join('migrate', 'approved', `${batch.batchId}.json`);
            if (fs.existsSync(approvedPath)) {
                 const approvedBatch = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
                 for (const [key, val] of Object.entries(updateData)) {
                    approvedBatch[key] = val;
                }
                fs.writeFileSync(approvedPath, JSON.stringify(approvedBatch, null, 2));
                console.log(`✅ Approved batch file updated: ${approvedPath}`);
            }

        } catch (err) {
            console.error(`❌ Failed to update local batch: ${err.message}`);
        }
    } else {
        try {
            await batchEntity.update(batch.batchEntityId, updateData);
        } catch (err) {
            console.error(`❌ Failed to update batch on server: ${err.message}`);
        }
    }
  }
}

function generateBankWireCSV(plan) {
  // Generate standard bank wire CSV format
  // Format: IBAN,Amount,Currency,Beneficiary Name,Reference
  let csv = 'IBAN,Amount,Currency,Beneficiary Name,Reference\n';
  
  const iban = process.env.OWNER_BANK_IBAN || '007810000448500030594182';
  const name = process.env.OWNER_NAME || 'Younes Tsouli';
  
  console.log(`💳 Using IBAN: ${iban}`);
  console.log(`👤 Beneficiary: ${name}`);

  for (const batch of plan.batches) {
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

async function executePayoneerBankMigration(plan, client) {
  console.log('🏦 Executing via Payoneer US Bank Wire (Global Payment Service)');
  
  const batchCfg = getPayoutBatchConfig();
  const batchEntity = client.asServiceRole.entities[batchCfg.entityName];

  // Generate Bank Wire CSV (US Format)
  const csvContent = generatePayoneerBankCSV(plan);
  const outPath = path.join('migrate', 'payoneer-bank-wire.csv');
  fs.writeFileSync(outPath, csvContent);
  
  // Generate Text Instructions
  const txtContent = generatePayoneerInstructions(plan);
  const txtPath = path.join('migrate', 'payoneer-instructions.txt');
  fs.writeFileSync(txtPath, txtContent);
  
  console.log(`📄 Payoneer Bank CSV generated: ${outPath}`);
  console.log(`📄 Instructions generated: ${txtPath}`);
  console.log('\n📋 PAYONEER WIRE INSTRUCTIONS (US CITIBANK):');
  console.log(txtContent);

  // Update batch status
  for (const batch of plan.batches) {
    const updateData = {
      [batchCfg.fieldMap.status]: 'exported_for_payoneer_wire',
      [batchCfg.fieldMap.notes]: {
        ...batch.notes,
        payoneer_exported: new Date().toISOString(),
        export_file: 'migrate/payoneer-bank-wire.csv',
        instructions_file: 'migrate/payoneer-instructions.txt',
        destination_type: 'payoneer_global_payment_service'
      }
    };

    if (batch.local) {
        console.log(`📝 Updating LOCAL batch ${batch.batchId} status...`);
        try {
            const approvedPath = path.join('migrate', 'approved', `${batch.batchId}.json`);
            if (fs.existsSync(approvedPath)) {
                 const approvedBatch = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
                 for (const [key, val] of Object.entries(updateData)) {
                    approvedBatch[key] = val;
                }
                fs.writeFileSync(approvedPath, JSON.stringify(approvedBatch, null, 2));
                console.log(`✅ Approved batch file updated: ${approvedPath}`);
            }
        } catch (err) {
            console.error(`❌ Failed to update local batch: ${err.message}`);
        }
    } else {
        try {
            await batchEntity.update(batch.batchEntityId, updateData);
        } catch (err) {
            console.error(`❌ Failed to update batch on server: ${err.message}`);
        }
    }
  }
}

function generatePayoneerBankCSV(plan) {
  // Format: Beneficiary Name, Bank Name, Account Number, Routing Number, Amount, Currency, Reference
  let csv = 'Beneficiary Name,Bank Name,Account Number,Routing Number,Account Type,Amount,Currency,Reference\n';
  
  const name = process.env.OWNER_NAME || 'Younes Tsouli';
  const bankName = process.env.OWNER_BANK_NAME || 'Citibank';
  const accountNum = process.env.OWNER_BANK_ACCOUNT_NUM || '70581950001361949';
  const routing = process.env.OWNER_BANK_ROUTING || '031100209';
  const type = process.env.OWNER_BANK_TYPE || 'CHECKING';

  for (const batch of plan.batches) {
    const reference = `MIGRATION_${batch.batchId}`;
    csv += `${name},${bankName},${accountNum},${routing},${type},${batch.amount},${batch.currency},${reference}\n`;
  }
  return csv;
}

function generatePayoneerInstructions(plan) {
    const name = process.env.OWNER_NAME || 'Younes Tsouli';
    const bankName = process.env.OWNER_BANK_NAME || 'Citibank';
    const address = process.env.OWNER_BANK_ADDRESS || '111 Wall Street New York, NY 10043 USA';
    const accountNum = process.env.OWNER_BANK_ACCOUNT_NUM || '70581950001361949';
    const routing = process.env.OWNER_BANK_ROUTING || '031100209';
    const swift = process.env.OWNER_BANK_SWIFT || 'CITIUS33';
    const type = process.env.OWNER_BANK_TYPE || 'CHECKING';
    const total = plan.totalAmount;

    return `
=== PAYONEER GLOBAL PAYMENT SERVICE INSTRUCTIONS ===
Use these details to transfer funds from PayPal, Stripe, or US Bank Account.

BENEFICIARY: ${name}
BANK NAME:   ${bankName}
ADDRESS:     ${address}
ACCOUNT #:   ${accountNum}
ROUTING (ABA): ${routing}
SWIFT CODE:  ${swift}
ACCOUNT TYPE: ${type}

AMOUNT: $${total} USD
REFERENCE: MIGRATION_BATCH_001

NOTE:
- Select "Checking" if asked for account type.
- This is a local US transfer (ACH/FedWire).
- Do NOT send International Wire if using Routing Number (use SWIFT if international).
- If sending from PayPal, add this as a "US Bank Account".
`;
}


executeMigration().catch(console.error);
