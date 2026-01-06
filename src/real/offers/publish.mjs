import fs from 'fs';
import path from 'path';
import { getRandomProduct } from '../products/ProductCatalog.mjs';
import { HeadlessPoster } from '../../marketing/HeadlessPoster.mjs';
import { recordSuccess } from '../../ops/AutoCommitChangelog.mjs';

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
    if (Array.isArray(finalOffer.payment_options)) {
        for (const opt of finalOffer.payment_options) {
            const t = opt.method.toUpperCase();
            let extra = '';
            if (opt.url) extra = opt.url;
            else if (opt.rib) extra = opt.rib;
            else if (opt.accountId) extra = `ID:${opt.accountId}`;
            else if (opt.address) extra = opt.address;
            const badges = Array.isArray(opt.badges) && opt.badges.length ? ` [${opt.badges.map(b => (b === 'Secure' ? '🔒' : '✅') + ' ' + b).join(' ')}]` : '';
            console.log(`   Route: ${t} -> ${extra}${badges}`);
        }
    }

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
    const links = Array.isArray(finalOffer.payment_options) ? finalOffer.payment_options.flatMap(opt => {
        if (opt.url) return [opt.url];
        if (opt.rib) return [`Bank Wire: ${opt.rib}`];
        if (opt.accountId) return [`Payoneer ID: ${opt.accountId}`];
        if (opt.address && opt.network) return [`${opt.coin || 'USDT'} ${opt.network}: ${opt.address}`];
        return [];
    }) : [finalOffer.checkout_url];
    queue.push({
        id: finalOffer.offer_id,
        title: finalOffer.title,
        price: finalOffer.price,
        link: finalOffer.checkout_url,
        links,
        text: `🚀 Master new skills! ${finalOffer.title} - Only $${finalOffer.price} #RealWorldCerts ${finalOffer.checkout_url}`,
        platform: 'All',
        created_at: new Date().toISOString()
    });
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    console.log(`   ✅ Added to Dashboard Queue: marketing_queue.json`);
    const summary = `Multi-Route publish success: ${finalOffer.title}`
    const details = { offer_id: finalOffer.offer_id, price: `$${finalOffer.price}`, routes: Array.isArray(finalOffer.payment_options) ? finalOffer.payment_options.map(o => o.method) : [finalOffer.payment_method] }
    const resCommit = recordSuccess(summary, details, `publish: ${finalOffer.offer_id}`)
    if (resCommit.push?.pushed) {
        console.log(`   ⬆️ Auto-pushed commit: ${resCommit.push.commit?.stdout || ''}`.trim())
    }

    // 4. Auto-post (headless) if enabled
    if (process.env.AUTO_POST === 'true') {
        const poster = new HeadlessPoster();
        const res = await poster.post({
            id: finalOffer.offer_id,
            title: finalOffer.title,
            price: finalOffer.price,
            link: finalOffer.checkout_url,
            links,
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
    const privacyStrict = String(process.env.PRIVACY_STRICT || '').toLowerCase() === 'true';
    const maskEmail = (e) => {
        if (!e) return '';
        const parts = String(e).split('@');
        if (parts.length < 2) return e;
        const local = parts[0];
        const domain = parts[1];
        const maskedLocal = local.length <= 1 ? '*' : local[0] + '*'.repeat(Math.max(1, local.length - 1));
        return `${maskedLocal}@${domain}`;
    };
    const routes = Array.isArray(offer.payment_options) ? offer.payment_options.map(opt => {
        const label = opt.method.toUpperCase();
        let extra = '';
        if (opt.url) extra = opt.url;
        else if (opt.rib) extra = opt.rib;
        else if (opt.email) extra = privacyStrict ? maskEmail(opt.email) : opt.email;
        else if (opt.address) extra = opt.address;
        const badges = Array.isArray(opt.badges) && opt.badges.length ? ` (${opt.badges.map(b => (b === 'Secure' ? '🔒' : '✅') + ' ' + b).join(' ')})` : '';
        return `- ${label}: ${extra}${badges}`;
    }).join('\n') : `- ${offer.payment_method.toUpperCase()}: ${offer.checkout_url}`;
    return `
========================================================================================
PLATFORM: Twitter / LinkedIn / Instagram
STATUS:   READY TO POST
DATE:     ${new Date().toISOString()}
========================================================================================
🚀 FLASH SALE ALERT! 🚀

Master new skills today with "${offer.title}"!

🎓 Certification Included
🔥 Limited Time Price: $${offer.price}
👇 Get Instant Access:
${routes}

#RealWorldCerts #OnlineLearning #${offer.category || 'Education'}
========================================================================================
`;
}
