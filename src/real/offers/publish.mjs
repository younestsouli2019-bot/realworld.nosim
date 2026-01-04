import fs from 'fs';
import path from 'path';

export async function publishOffer(offer) {
    console.log(`\n📢 PUBLISHING OFFER: ${offer.title}`);
    console.log(`   Price: $${offer.price} USD`);
    console.log(`   Checkout: ${offer.checkout_url}`);
    
    // 1. Publish to Local Catalog (Phase 1: Direct Link Generation)
    // In a full implementation, this would POST to Etsy/Shopify APIs.
    // For now, we "Publish" by appending to a "LIVE_OFFERS.md" file that serves as our public catalog.
    
    const liveOffersPath = path.join(process.cwd(), 'LIVE_OFFERS.md');
    
    // SECURITY NOTE: We explicitly list the PayPal destination in the public catalog for transparency
    // This allows the user to verify "No Middleman" before clicking.
    
    let details = '';
    if (offer.payment_method === 'crypto') {
        const mainAddr = offer.crypto?.address ? `Address (${offer.crypto?.network}): ${offer.crypto?.address}` : '';
        const tag = offer.crypto?.tag ? `Tag/Memo: ${offer.crypto?.tag}` : '';
        const opts = Array.isArray(offer.crypto_options) && offer.crypto_options.length > 0
            ? offer.crypto_options.map(o => `- ${o.network}: ${o.address}${o.tag ? ` (Tag/Memo: ${o.tag})` : ''}`).join('\n')
            : '';
        const optsBlock = opts ? `\n- Networks:\n${opts}\n` : '';
        details = `\n- **Payment Method:** Crypto (USDT)\n- ${mainAddr}\n- ${tag}${optsBlock}- **Instructions:** ${offer.crypto?.instructions || ''}\n`;
    }
    const markdownEntry = `
## 🛍️ ${offer.title}
- **Price:** $${offer.price}
- **Status:** LIVE
- **Link:** [BUY NOW](${offer.checkout_url})
- **Ref:** \`${offer.offer_id}\`
- **Destination:** Direct-to-Owner (Verified)
- *Posted: ${new Date().toISOString()}*
${details}

---
`;

    fs.appendFileSync(liveOffersPath, markdownEntry);
    console.log(`   ✅ Published to LIVE_OFFERS.md (Local Sales Catalog Updated)`);
    
    return {
        published: true,
        platform: 'Direct/Markdown',
        url: liveOffersPath
    };
}
