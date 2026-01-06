#!/usr/bin/env node

import './env-loader.mjs';
import { auditTrackedRevenue } from './audit-tracked-revenue.mjs';
import { createMigrationBatches } from './create-migration-batches.mjs';
import { approveMigrationBatches } from './approve-migration-batches.mjs';
import { executeMigration } from './execute-migration.mjs';
import fs from 'fs';
import path from 'path';

async function runFullMigration() {
  console.log('🚀 STARTING FULL REVENUE MIGRATION');
  console.log('====================================\n');
  
  try {
    // Step 1: Audit
    console.log('📊 STEP 1: Auditing tracked revenue...');
    await auditTrackedRevenue();
    console.log('✅ Audit complete\n');
    
    // Step 2: Create batches
    console.log('📦 STEP 2: Creating migration batches...');
    const plan = await createMigrationBatches();
    if (!plan) {
        console.log("No batches created. Exiting.");
        return;
    }
    console.log(`✅ Created ${plan.totalBatches} batches for ${plan.totalAmount}\n`);
    
    // Step 3: Approve
    console.log('🔓 STEP 3: Approving batches...');
    await approveMigrationBatches();
    console.log('✅ All batches approved\n');
    
    // Step 4: Execute
    console.log('💸 STEP 4: Executing migration...');
    await executeMigration();
    console.log('✅ Migration execution initiated\n');
    
    // Step 5: Generate summary
    console.log('📋 STEP 5: Generating migration summary...');
    await generateSummary();
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log('====================================');
    // Read total amount from plan
    const planPath = path.join('migrate', 'migration-plan.json');
    const finalPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    console.log(`💰 $${finalPlan.totalAmount.toLocaleString()} tracked revenue migrated`);
    console.log('📄 Check migrate/migration-summary.md for details');
    console.log('📊 Monitor with: npm run status:reality-check');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function generateSummary() {
  const auditPath = path.join('migrate', 'audit-report.json');
  const planPath = path.join('migrate', 'migration-plan.json');
  
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  
  const summary = `# TRACKED REVENUE MIGRATION SUMMARY

## 📊 Original State
- **Total Tracked Revenue:** $${audit.totalTrackedAmount.toLocaleString()}
- **Revenue Events:** ${audit.totalRevenueEvents}
- **Unpaid Events:** ${audit.unpaidRevenue.count}
- **Unpaid Amount:** $${audit.unpaidRevenue.total.toLocaleString()}

## 🚀 Migration Execution
- **Migration Date:** ${new Date().toLocaleString()}
- **Batches Created:** ${plan.totalBatches}
- **Total Migrated:** $${plan.totalAmount.toLocaleString()}
- **Destination:** ${plan.batches[0]?.destination || 'Unknown'}

## 📦 Migration Batches
${plan.batches.map(b => `- **${b.batchId}**: ${b.amount} ${b.currency} (${b.eventCount} events) → ${b.destination}`).join('\n')}

## ✅ Status
${plan.approved ? `✅ **Approved**: ${plan.approved} (${plan.approval_method})` : '❌ **Not Approved**'}

## 📁 Generated Files
1. \`audit-report.json\` - Detailed revenue audit
2. \`migration-plan.json\` - Migration execution plan
3. \`bank-wire-export.csv\` - Bank wire instructions (if applicable)
4. \`payoneer-export.csv\` - Payoneer instructions (if applicable)

## 🎯 Next Steps
1. Monitor payout status: \`npm run status:reality-check\`
2. Check PayPal/Bank for funds arrival
3. Update ledger when funds received: \`npm run emit:revenue -- --mark-completed\`
4. Archive migration files for audit trail

---

*Migration completed by autonomous system on ${new Date().toISOString()}*`;

  fs.writeFileSync(path.join('migrate', 'migration-summary.md'), summary);
  console.log('📄 Summary saved: migrate/migration-summary.md');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullMigration();
}

export { runFullMigration };
