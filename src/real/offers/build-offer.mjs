import crypto from 'crypto';

export async function buildOffer(idea) {
    const price = idea.price_usd || 19.99;
    const ownerPaypal = process.env.OWNER_PAYPAL || "younestsouli2019@gmail.com";
    
    // Create a unique Reference ID for this execution
    const offerId = `OFFER_${idea.id}_${Date.now()}`;
    
    // Generate REAL PayPal Standard Payment Link
    // cmd=_xclick : Buy Now button behavior
    // business : Owner email
    // item_name : Product Title
    // amount : Price
    // currency_code : USD
    // custom : Our internal tracking ID (offerId) to reconcile later
    
    // Customize for SelarBot
    let title = idea.title;
    if (idea.handoff_agent === 'selarbot' || title.toLowerCase().includes('selar')) {
        title = `[Selar] ${title}`;
    }

    const params = new URLSearchParams({
        cmd: '_xclick',
        business: ownerPaypal,
        currency_code: 'USD',
        amount: price.toFixed(2),
        item_name: title,
        custom: offerId,
        return: 'https://base44.app/payment-success', // Placeholder return URL
        cancel_return: 'https://base44.app/payment-cancel'
    });

    const checkoutUrl = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;

    return {
        idea_id: idea.id,
        offer_id: offerId,
        title: idea.title,
        price: price,
        currency: 'USD',
        checkout_url: checkoutUrl,
        timestamp: new Date().toISOString()
    };
}
