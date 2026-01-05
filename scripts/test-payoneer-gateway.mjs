import { PayoneerGateway } from '../src/financial/gateways/PayoneerGateway.mjs';

async function test() {
    console.log("🧪 Testing PayoneerGateway...");
    const gateway = new PayoneerGateway();
    
    const txs = [
        { amount: 100.50, currency: 'USD', destination: 'younestsouli2019@gmail.com', reference: 'Test Payment 1' },
        { amount: 250.00, currency: 'USD', destination: 'younesdgc@gmail.com', reference: 'Test Payment 2' }
    ];
    
    const result = await gateway.generateBatch(txs);
    console.log("Result:", result);
}

test().catch(console.error);
