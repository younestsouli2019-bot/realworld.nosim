import crypto from 'crypto';
import { OWNER_ACCOUNTS } from '../../owner-directive.mjs';
import { RailOptimizer } from '../../swarm/rail-optimizer.mjs';
import { binanceClient } from '../../crypto/binance-client.mjs';

export async function buildOffer(idea) {
    const price = idea.price_usd || 19.99;
    
    // STRICT OWNER DIRECTIVE: Always use the hardcoded owner account
    const ownerPaypal = OWNER_ACCOUNTS.paypal.email;
    
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

    // Decide preferred rail
    const optimizer = new RailOptimizer();
    const selectedRail = optimizer.selectRail(price, 'USD', 'MA', 'owner');
    const preferCrypto = selectedRail === 'crypto';
    
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

    if (preferCrypto) {
        const network = process.env.BINANCE_USDT_NETWORK || 'TRX';
        let dep = null;
        try {
            if (await binanceClient.isReady()) {
                dep = await binanceClient.getDepositAddress('USDT', network);
            }
        } catch {}
        if (!dep) {
            dep = binanceClient.getEnvDepositAddress('USDT', network) || null;
        }
        const cryptoOptions = [];
        const trxAddr = process.env.CRYPTO_USDT_TRX_ADDRESS || null;
        if (trxAddr) cryptoOptions.push({ provider: 'wallet', coin: 'USDT', network: 'TRX', address: trxAddr, tag: process.env.CRYPTO_USDT_TRX_TAG || null });
        const bscAddr = process.env.CRYPTO_USDT_BEP20_ADDRESS || null;
        if (bscAddr) cryptoOptions.push({ provider: 'wallet', coin: 'USDT', network: 'BSC', address: bscAddr, tag: process.env.CRYPTO_USDT_BEP20_TAG || null });
        const ercAddr = process.env.CRYPTO_USDT_ERC20_ADDRESS || null;
        if (ercAddr) cryptoOptions.push({ provider: 'wallet', coin: 'USDT', network: 'ETH', address: ercAddr, tag: process.env.CRYPTO_USDT_ERC20_TAG || null });
        let address = dep?.address || null;
        let tag = dep?.tag || null;
        if (!address) {
            if (String(network).toUpperCase() === 'BSC') {
                address = bscAddr || null;
                tag = process.env.CRYPTO_USDT_BEP20_TAG || null;
            } else if (String(network).toUpperCase() === 'TRX' || String(network).toUpperCase() === 'TRC20') {
                address = trxAddr || null;
                tag = process.env.CRYPTO_USDT_TRX_TAG || null;
            } else if (String(network).toUpperCase() === 'ETH' || String(network).toUpperCase() === 'ERC20') {
                address = ercAddr || null;
                tag = process.env.CRYPTO_USDT_ERC20_TAG || null;
            }
        }
        if (address || cryptoOptions.length > 0) {
            return {
                idea_id: idea.id,
                offer_id: offerId,
                title: idea.title,
                price: price,
                currency: 'USD',
                checkout_url: checkoutUrl,
                timestamp: new Date().toISOString(),
                payment_method: 'crypto',
                crypto: {
                    provider: 'binance',
                    coin: 'USDT',
                    network,
                    address: address,
                    tag: tag,
                    instructions: `Send ${price.toFixed(2)} USDT to the address above on ${network}. Include MEMO/TAG if provided.`
                },
                crypto_options: cryptoOptions
            };
        }
    }
    
    return {
        idea_id: idea.id,
        offer_id: offerId,
        title: idea.title,
        price: price,
        currency: 'USD',
        checkout_url: checkoutUrl,
        timestamp: new Date().toISOString(),
        payment_method: 'paypal'
    };
}
