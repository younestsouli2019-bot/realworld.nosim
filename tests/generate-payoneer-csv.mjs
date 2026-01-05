import { PayoneerGateway } from '../src/financial/gateways/PayoneerGateway.mjs';
async function run() {
  const gw = new PayoneerGateway();
  const res = await gw.generateBatch([
    { amount: 250, currency: 'USD', destination: 'younestsouli2019@gmail.com', reference: 'Owner Settlement Demo' }
  ]);
  console.log(JSON.stringify(res, null, 2));
}
run().catch(e => { console.error('GEN_FAIL', e.message || String(e)); process.exit(1); });
