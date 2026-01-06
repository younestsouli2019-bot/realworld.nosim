import { ipcCall } from '../src/api/external-payment-ipc-client.mjs';
const token = (process.env.AGENT_API_TOKENS || 'test-token').split(',')[0];
const body = { payoutBatchId: `BATCH_${Date.now()}`, items: [{ amount: 25.00, currency: 'USD', recipient_email: 'younestsouli2019@gmail.com', note: 'Owner Settlement' }] };
const res = await ipcCall({ path: '/settlement/auto', body, token });
console.log(JSON.stringify(res));

