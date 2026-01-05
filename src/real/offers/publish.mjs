import fs from 'fs';
import path from 'path';
import { getRandomProduct } from '../products/ProductCatalog.mjs';
import { HeadlessPoster } from '../../marketing/HeadlessPoster.mjs';

export async function publishOffer(offer) {
    // 1. Sanitize: Replace "Internal Task" offers with REAL COURSES
    // If the offer title looks like a Jira ticket, swap it for a RealWorldCerts course.
    let finalOffer = offer;
    if (offer.title.includes('API') || offer.title.includes('Verification') || offer.title.includes('Overhaul')) {
        const realProduct = getRandomProduct();
        console.log(`\n🔄 SWAPPING INTERNAL TASK FOR REAL PRODUCT:`);
        console.log(`   Old: ${offer.title} ($${offer.price})`);
        console.log(`   New: ${realProduct.title} ($${realProduct.price})`);
        
        finalOffer = {
            ...offer,
            title: realProduct.title,
            price: realProduct.price,
            checkout_url: realProduct.url,
            description: realProduct.description,
            offer_id: `OFFER_${realProduct.id}_${Date.now()}`
        };
    }

    console.log(`\n📢 PUBLISHING OFFER (REAL WORLD): ${finalOffer.title}`);
    console.log(`   Price: $${finalOffer.price} USD`);
    console.log(`   Link:  ${finalOffer.checkout_url}`);

    // 2. Generate Social Media Post Drafts
    // We create a "Ready-to-Post" file for the user to copy-paste.
    const socialPost = generateSocialPost(finalOffer);
    
    // Append to "READY_TO_POST.txt"
    const postPath = path.join(process.cwd(), 'READY_TO_POST.txt');
    fs.appendFileSync(postPath, socialPost);
    
    // 3. Update JSON Queue for Dashboard
    const queuePath = path.join(process.cwd(), 'marketing_queue.json');
    let queue = [];
    if (fs.existsSync(queuePath)) {
        try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch (e) {}
    }
    queue.push({
        id: finalOffer.offer_id,
        title: finalOffer.title,
        price: finalOffer.price,
        link: finalOffer.checkout_url,
        text: `🚀 Master new skills! ${finalOffer.title} - Only $${finalOffer.price} #RealWorldCerts ${finalOffer.checkout_url}`,
        platform: 'All',
        created_at: new Date().toISOString()
    });
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    console.log(`   ✅ Added to Dashboard Queue: marketing_queue.json`);

    // 4. Auto-post (headless) if enabled
    if (process.env.AUTO_POST === 'true') {
        const poster = new HeadlessPoster();
        const res = await poster.post({
            id: finalOffer.offer_id,
            title: finalOffer.title,
            price: finalOffer.price,
            link: finalOffer.checkout_url,
            text: `🚀 Master new skills! ${finalOffer.title} - Only $${finalOffer.price} #RealWorldCerts ${finalOffer.checkout_url}`
        });
        console.log(`   🤖 HeadlessPoster: ${res.status}`);
    }

    return {
        published: true,
        platform: 'SocialDraft',
        url: postPath,
        offer: finalOffer
    };
}

function generateSocialPost(offer) {
    return `
================================================================================
PLATFORM: Twitter / LinkedIn / Instagram
STATUS:   READY TO POST
DATE:     ${new Date().toISOString()}
================================================================================
🚀 FLASH SALE ALERT! 🚀

Master new skills today with "${offer.title}"!

🎓 Certification Included
🔥 Limited Time Price: $${offer.price}
👇 Get Instant Access:
${offer.checkout_url}

#RealWorldCerts #OnlineLearning #${offer.category || 'Education'}
================================================================================
`;
}
