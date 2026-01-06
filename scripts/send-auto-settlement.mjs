import '../src/load-env.mjs';
import { ExternalGatewayManager } from '../src/finance/ExternalGatewayManager.mjs';
import { submitWire } from '../src/financial/broadcast/WireSubmissionBroadcaster.mjs';

const storage = { load: () => null, save: (t, i, d) => ({ ...d, id: i }) };
const audit = { log: (...args) => console.log('AUDIT', args[0], args[1]) };
const executor = { execute: async (k, fn) => fn() };

async function main() {
  const gw = new ExternalGatewayManager(storage, audit, executor);
  const items = [{
    amount: Number(process.env.SETTLEMENT_AMOUNT_USD || '1'),
    currency: 'USD',
    recipient_email: process.env.OWNER_PAYPAL_EMAIL,
    recipient_address: process.env.OWNER_BANK_RIB || process.env.CRYPTO_OWNER_ADDRESS || process.env.OWNER_CRYPTO_ADDRESS || '',
    note: process.env.SETTLEMENT_NOTE || 'Auto settlement'
  }];
  const prepared = await gw.initiateAutoSettlement(`BATCH_${Date.now()}`, items, `AUTO_${Date.now()}`);
  const tx = items.map(item => ({
    amount: item.amount,
    currency: item.currency,
    destination: item.recipient_address || item.recipient_email,
    reference: item.note
  }));
  const route = prepared.route_attempted;
  const sent = await gw.broadcastSettlement(route, prepared, tx);
  let submission = null;
  if (route === 'bank_transfer') {
    submission = await submitWire();
  }
  console.log(JSON.stringify({ prepared, sent, submission }, null, 2));
}

main();
