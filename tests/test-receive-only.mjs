import { PayoneerGateway } from '../src/financial/gateways/PayoneerGateway.mjs'
import { PayPalGateway } from '../src/financial/gateways/PayPalGateway.mjs'
import { CryptoGateway } from '../src/financial/gateways/CryptoGateway.mjs'

async function main() {
  process.env.PAYONEER_MODE = 'RECEIVE'
  process.env.PAYPAL_MODE = 'RECEIVE'
  process.env.CRYPTO_MODE = 'RECEIVE'

  const txs = [{ amount: 10, currency: 'USD', destination: 'client@example.com', reference: 'Test' }]

  const pg = new PayoneerGateway()
  const pr = await pg.executePayout(txs)
  console.log('Payoneer result:', pr.mode || pr.status)

  const pp = new PayPalGateway()
  const pi = await pp.executePayout(txs)
  console.log('PayPal result:', pi.mode || pi.status)

  const cg = new CryptoGateway()
  const cr = await cg.sendTransaction(10, 'USDT', '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7')
  console.log('Crypto result:', cr.status)
}

main()
