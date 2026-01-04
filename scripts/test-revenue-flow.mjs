#!/usr/bin/env node
// scripts/test-revenue-flow.mjs
// End-to-end test of revenue generation and settlement flow

import { buildBase44Client } from '../src/base44-client.mjs';
import { getRevenueConfigFromEnv } from '../src/base44-revenue.mjs';
import { createPayPalPayoutBatch } from '../src/paypal-api.mjs';
import { OWNER_ACCOUNTS } from '../src/owner-directive.mjs';
import '../src/load-env.mjs';

const TEST_AMOUNT = parseFloat(process.env.TEST_AMOUNT || '1.00');
const DRY_RUN = process.argv.includes('--dry-run');

async function testRevenueFlow() {
    console.log('🧪 End-to-End Revenue Flow Test');
    console.log('='.repeat(60));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION'}`);
    console.log(`Test Amount: $${TEST_AMOUNT.toFixed(2)} USD`);
    console.log('');

    const results = {
        revenueEvent: null,
        earning: null,
        payoutBatch: null,
        paypalResponse: null
    };

    try {
        // Step 1: Create Revenue Event
        console.log('Step 1: Creating revenue event...');
        const base44 = await buildBase44Client();
        const revenueConfig = getRevenueConfigFromEnv();
        const revenueEntity = base44.asServiceRole.entities[revenueConfig.entityName];

        const revenueEvent = {
            event_id: `TEST_REV_${Date.now()}`,
            amount: TEST_AMOUNT,
            currency: 'USD',
            occurred_at: new Date().toISOString(),
            source: 'test_revenue_flow',
            status: 'VERIFIED',
            verification_proof: {
                type: 'test',
                psp_id: `TEST_PSP_${Date.now()}`,
                amount: TEST_AMOUNT,
                currency: 'USD',
                timestamp: new Date().toISOString()
            },
            metadata: {
                test: true,
                dry_run: DRY_RUN,
                created_by: 'test-revenue-flow'
            },
            settled: false,
            created_at: new Date().toISOString()
        };

        if (!DRY_RUN) {
            const created = await revenueEntity.create(revenueEvent);
            results.revenueEvent = created;
            console.log(`   ✅ Revenue event created: ${revenueEvent.event_id}`);
        } else {
            results.revenueEvent = revenueEvent;
            console.log(`   ✓ Revenue event prepared (dry run): ${revenueEvent.event_id}`);
        }

        // Step 2: Create Owner Earning
        console.log('\nStep 2: Creating owner earning...');
        const earning = {
            earning_id: `TEST_EARN_${Date.now()}`,
            amount: TEST_AMOUNT,
            currency: 'USD',
            occurred_at: revenueEvent.occurred_at,
            source: revenueEvent.source,
            beneficiary: OWNER_ACCOUNTS.paypal.email,
            status: 'pending_payout',
            revenue_event_id: revenueEvent.event_id,
            metadata: {
                test: true,
                recipient_type: 'owner',
                owner_directive_enforced: true
            },
            created_at: new Date().toISOString()
        };

        if (!DRY_RUN) {
            try {
                const earningEntity = base44.asServiceRole.entities.Earning;
                const createdEarning = await earningEntity.create(earning);
                results.earning = createdEarning;
                console.log(`   ✅ Earning created: ${earning.earning_id}`);
                console.log(`   → Beneficiary: ${earning.beneficiary} (OWNER)`);
            } catch (error) {
                console.warn(`   ⚠️  Earning creation failed: ${error.message}`);
                console.warn(`   Continuing with payout test...`);
            }
        } else {
            results.earning = earning;
            console.log(`   ✓ Earning prepared (dry run): ${earning.earning_id}`);
            console.log(`   → Beneficiary: ${earning.beneficiary} (OWNER)`);
        }

        // Step 3: Create Payout Batch
        console.log('\nStep 3: Creating payout batch...');
        const batch = {
            batch_id: `TEST_BATCH_${Date.now()}`,
            status: 'approved',
            total_amount: TEST_AMOUNT,
            currency: 'USD',
            created_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            payout_method: 'paypal',
            recipient: OWNER_ACCOUNTS.paypal.email,
            recipient_type: 'owner',
            earning_ids: [earning.earning_id],
            revenue_event_ids: [revenueEvent.event_id],
            owner_directive_enforced: true,
            items: [{
                item_id: `TEST_ITEM_${Date.now()}`,
                amount: TEST_AMOUNT,
                currency: 'USD',
                recipient: OWNER_ACCOUNTS.paypal.email,
                recipient_type: 'EMAIL',
                revenue_event_id: revenueEvent.event_id,
                earning_id: earning.earning_id,
                note: 'Test revenue settlement'
            }]
        };

        results.payoutBatch = batch;
        console.log(`   ✅ Payout batch created: ${batch.batch_id}`);
        console.log(`   → Recipient: ${batch.recipient} (OWNER)`);
        console.log(`   → Amount: $${batch.total_amount.toFixed(2)} ${batch.currency}`);

        // Step 4: Execute PayPal Payout
        console.log('\nStep 4: Executing PayPal payout...');

        if (DRY_RUN) {
            console.log(`   ✓ Payout prepared (dry run)`);
            console.log(`   → Would send $${TEST_AMOUNT.toFixed(2)} to ${OWNER_ACCOUNTS.paypal.email}`);
        } else {
            try {
                const paypalPayload = {
                    senderBatchId: batch.batch_id,
                    items: batch.items.map(item => ({
                        recipient_type: 'EMAIL',
                        amount: {
                            value: item.amount.toFixed(2),
                            currency: item.currency
                        },
                        receiver: item.recipient,
                        note: item.note || 'Test revenue settlement',
                        sender_item_id: item.item_id
                    })),
                    emailSubject: 'Test Revenue Settlement',
                    emailMessage: 'This is a test payout from your autonomous revenue system'
                };

                const paypalResponse = await createPayPalPayoutBatch(paypalPayload);
                results.paypalResponse = paypalResponse;

                console.log(`   ✅ PayPal payout submitted successfully`);
                console.log(`   → Payout Batch ID: ${paypalResponse.batch_header.payout_batch_id}`);
                console.log(`   → Status: ${paypalResponse.batch_header.batch_status}`);
                console.log(`   → Amount: $${TEST_AMOUNT.toFixed(2)} USD`);
                console.log(`   → Recipient: ${OWNER_ACCOUNTS.paypal.email}`);

                // Update revenue event as settled
                if (results.revenueEvent) {
                    await revenueEntity.update(results.revenueEvent.id, {
                        settled: true,
                        settled_at: new Date().toISOString(),
                        payout_batch_id: batch.batch_id,
                        settlement_details: {
                            paypal_batch_id: paypalResponse.batch_header.payout_batch_id,
                            method: 'paypal'
                        }
                    });
                    console.log(`   ✅ Revenue event marked as settled`);
                }

            } catch (error) {
                console.error(`   ❌ PayPal payout failed: ${error.message}`);
                throw error;
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ END-TO-END REVENUE FLOW TEST COMPLETE');
        console.log('='.repeat(60));
        console.log('\n📊 Test Results:');
        console.log(`   Revenue Event: ${results.revenueEvent ? '✅' : '❌'}`);
        console.log(`   Owner Earning: ${results.earning ? '✅' : '⚠️'}`);
        console.log(`   Payout Batch: ${results.payoutBatch ? '✅' : '❌'}`);
        console.log(`   PayPal Payout: ${results.paypalResponse ? '✅' : DRY_RUN ? '✓ (dry run)' : '❌'}`);

        if (!DRY_RUN && results.paypalResponse) {
            console.log('\n💰 REAL MONEY TRANSFERRED:');
            console.log(`   Amount: $${TEST_AMOUNT.toFixed(2)} USD`);
            console.log(`   To: ${OWNER_ACCOUNTS.paypal.email}`);
            console.log(`   PayPal Batch: ${results.paypalResponse.batch_header.payout_batch_id}`);
            console.log('\n⏰ Check your PayPal account in 1-2 hours to confirm receipt');
        }

        if (DRY_RUN) {
            console.log('\n✓ Dry run completed successfully');
            console.log('  Run without --dry-run to execute real payout');
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run test
console.log('');
if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No real money will be transferred');
} else {
    console.log('🚨 LIVE MODE - Real money will be transferred!');
    console.log(`   Amount: $${TEST_AMOUNT.toFixed(2)} will be sent to ${OWNER_ACCOUNTS.paypal.email}`);
}
console.log('');

testRevenueFlow().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
