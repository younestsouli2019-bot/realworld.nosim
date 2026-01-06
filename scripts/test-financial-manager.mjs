
import { AdvancedFinancialManager } from '../src/finance/AdvancedFinancialManager.mjs';

async function main() {
  console.log('Testing AdvancedFinancialManager integration...');
  
  try {
    const manager = new AdvancedFinancialManager();
    await manager.initialize();
    
    console.log('Manager initialized.');
    
    if (manager.gateway) {
      console.log('✅ ExternalGatewayManager is attached.');
      
      // Check methods
      const hasInitiate = typeof manager.gateway.initiatePayPalPayout === 'function';
      const hasUpdate = typeof manager.gateway.updateExternalPayoutStatus === 'function';
      const hasBalance = typeof manager.gateway.getPayPalBalance === 'function';
      
      console.log(`   - initiatePayPalPayout: ${hasInitiate ? 'OK' : 'MISSING'}`);
      console.log(`   - updateExternalPayoutStatus: ${hasUpdate ? 'OK' : 'MISSING'}`);
      console.log(`   - getPayPalBalance: ${hasBalance ? 'OK' : 'MISSING'}`);
      
      if (hasInitiate && hasUpdate && hasBalance) {
          console.log('✅ All requested API methods are present.');
      } else {
          console.error('❌ Missing one or more API methods.');
          process.exit(1);
      }

    } else {
      console.error('❌ ExternalGatewayManager is MISSING.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
