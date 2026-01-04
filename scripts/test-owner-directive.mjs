
import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';

async function testOwnerDirective() {
  console.log('🔒 TESTING OWNER REVENUE DIRECTIVE');
  console.log('=================================');
  
  const manager = new AdvancedFinancialManager();
  
  // Test 1: Create Valid Owner Recipient
  console.log('\n[1] Testing Valid Owner Creation...');
  try {
    const owner = manager.recipients.createRecipient({
      name: 'Younes Tsouli',
      email: 'younestsouli2019@gmail.com',
      payment_methods: [
        { type: 'paypal', details: { email: 'younestsouli2019@gmail.com' } }
      ]
    });
    console.log('    ✅ Owner created successfully:', owner.id);
  } catch (e) {
    console.error('    ❌ Failed to create owner:', e.message);
  }

  // Test 2: Create Invalid Recipient (Attacker)
  console.log('\n[2] Testing Invalid Recipient (Attacker)...');
  try {
    manager.recipients.createRecipient({
      name: 'Hacker',
      email: 'hacker@evil.com',
      payment_methods: [
        { type: 'paypal', details: { email: 'hacker@evil.com' } }
      ]
    });
    console.error('    ❌ FAIL: Attacker recipient was created!');
  } catch (e) {
    console.log('    ✅ BLOCKED:', e.message);
  }

  // Test 3: Update Recipient to Invalid
  console.log('\n[3] Testing Update to Invalid Account...');
  try {
    // First create a recipient with valid email (since we only check payment_methods strictly for now)
    // Note: In a real hard-lock, we might even block the creation if the *primary* email doesn't match, 
    // but the critical part is the PAYMENT METHOD.
    const r = manager.recipients.createRecipient({
      name: 'Test Update',
      email: 'younestsouli2019@gmail.com'
    });
    
    // Now try to add a bad payment method
    manager.recipients.updateRecipient(r.id, {
      payment_methods: [
        { type: 'bank', details: { rib: '999999999999' } }
      ]
    });
    console.error('    ❌ FAIL: Invalid payment method added!');
  } catch (e) {
    console.log('    ✅ BLOCKED:', e.message);
  }
}

testOwnerDirective().catch(console.error);
