import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';

async function testAdvancedFinance() {
  console.log('================================================================');
  console.log('💰 TESTING ADVANCED FINANCIAL MANAGER');
  console.log('================================================================');

  const manager = new AdvancedFinancialManager();
  await manager.initialize();

  // 1. Recipient Management
  console.log('\n[1] RECIPIENT MANAGEMENT');
  const recipient = manager.recipients.createRecipient({
    name: 'John Doe',
    email: 'john@example.com',
    type: 'individual',
    payment_methods: [{ type: 'paypal', details: 'john@paypal.com' }]
  });
  console.log('   ✅ Created Recipient:', recipient.id, recipient.name);

  // 2. Revenue Ingestion
  console.log('\n[2] REVENUE INGESTION');
  const event1 = manager.revenue.ingestRawRevenue({
    amount: 1500.00,
    currency: 'USD',
    source: 'MissionManager',
    transaction_id: 'TXN_12345'
  }, 'MissionSystem');
  console.log('   ✅ Ingested Event 1:', event1.id, `$${event1.amount}`);

  const event2 = manager.revenue.ingestRawRevenue({
    amount: 500.00,
    currency: 'EUR',
    source: 'SalesPlatform',
    timestamp: new Date().toISOString()
  }, 'SalesSystem');
  console.log('   ✅ Ingested Event 2:', event2.id, `€${event2.amount}`);

  // 3. Currency Conversion
  console.log('\n[3] MULTI-CURRENCY');
  const usdAmount = manager.currency.convert(500, 'EUR', 'USD');
  console.log(`   💱 Converted €500 to USD: $${usdAmount.toFixed(2)}`);

  // 4. Financial Goals
  console.log('\n[4] FINANCIAL GOALS');
  const goal = manager.goals.createGoal('Monthly Revenue Target', 5000, '2026-02-01');
  console.log('   ✅ Created Goal:', goal.name, `$${goal.target_amount}`);
  
  const status = manager.goals.checkGoals();
  console.log('   📊 Goal Status:', JSON.stringify(status, null, 2));

  // 5. Reconciliation
  console.log('\n[5] RECONCILIATION');
  const bankStatement = `Date,Desc,Amount,Currency,Ref
2026-01-04,Payment from Client,1500.00,USD,TXN_12345
2026-01-05,Unknown Transfer,50.00,USD,REF_999`;
  
  const reconResult = manager.reconciliation.importExternalStatement(bankStatement, 'BankOfAmerica');
  console.log(`   ✅ Reconciliation Results: ${reconResult.matches.length} Matched, ${reconResult.unmatched.length} Unmatched`);
  console.log('   Matched:', reconResult.matches.map(m => `${m.internal} <-> ${m.external.ref}`));

  // 6. Forecasting
  console.log('\n[6] FORECASTING');
  const forecast = manager.goals.generateForecast();
  console.log('   📈 Revenue Forecast:', JSON.stringify(forecast, null, 2));

  // 7. Recurring Payouts
  console.log('\n[7] RECURRING PAYOUTS');
  const schedule = manager.recurring.createSchedule(recipient.id, 100, 'USD', 'monthly', new Date().toISOString());
  console.log('   ✅ Created Schedule:', schedule.id, schedule.frequency);
  
  const payoutEvents = manager.recurring.processSchedules();
  console.log('   ✅ Processed Schedules. Generated Events:', payoutEvents.length);
  if (payoutEvents.length > 0) {
    console.log(`   Event ID: ${payoutEvents[0].id}, Amount: $${payoutEvents[0].amount}`);
  }

  console.log('\n================================================================');
  console.log('✅ TEST COMPLETED SUCCESSFULLY');
}

testAdvancedFinance().catch(console.error);
