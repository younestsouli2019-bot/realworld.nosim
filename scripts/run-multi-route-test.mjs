import '../src/load-env.mjs';
import { ExternalGatewayManager } from '../src/finance/ExternalGatewayManager.mjs';

const storage = { load: () => null, save: (t, i, d) => ({ ...d, id: i }) };
const audit = { log: (...args) => console.log('AUDIT', args[0], args[1]) };
const executor = { execute: async (k, fn) => fn() };

async function main() {
  const gw = new ExternalGatewayManager(storage, audit, executor);
  const items = [{
    amount: 1.0,
    currency: 'USD',
    recipient_email: process.env.OWNER_PAYPAL_EMAIL,
    recipient_address: process.env.CRYPTO_OWNER_ADDRESS || undefined,
    note: 'Multi-route test'
  }];
  const res = await gw.initiateAutoSettlement(`BATCH_${Date.now()}`, items, `AUTO_${Date.now()}`);
  console.log(JSON.stringify(res, null, 2));
}

main();

