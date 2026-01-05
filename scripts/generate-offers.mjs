import { publishOffer } from '../src/real/offers/publish.mjs'
import { REAL_WORLD_CERTS_CATALOG } from '../src/real/products/ProductCatalog.mjs'

async function run() {
  console.log('\n🛒 Generating Offers')
  console.log('====================')
  const picks = REAL_WORLD_CERTS_CATALOG.slice(0, 2)
  for (const p of picks) {
    const offer = {
      title: p.title,
      price: p.price,
      checkout_url: p.url,
      reference: `AUTO_${p.id}`,
      offer_id: `AUTO_${p.id}_${Date.now()}`
    }
    await publishOffer(offer)
  }
  console.log('✅ Two offers generated')
}

run()
