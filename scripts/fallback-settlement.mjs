import { ExternalPaymentAPI } from '../src/api/external-payment-api.mjs'

async function main() {
  const api = new ExternalPaymentAPI()
  await api.initialize()
  const items = [
    { amount: 25.00, currency: 'USD', recipient_email: 'younestsouli2019@gmail.com', note: 'Owner Settlement' }
  ]
  const res = await api.requestAutoSettlement({ payoutBatchId: `BATCH_${Date.now()}`, items, actor: 'OpsFallback' })
  console.log(JSON.stringify(res))
}

main().catch(e => { console.error(String(e.message || e)) ; process.exit(1) })

