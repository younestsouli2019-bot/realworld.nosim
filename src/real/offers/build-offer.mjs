import crypto from 'crypto';
import { OWNER_ACCOUNTS } from '../../owner-directive.mjs';
import { RailOptimizer } from '../../swarm/rail-optimizer.mjs';
import { binanceClient } from '../../crypto/binance-client.mjs';
import { shouldAvoidPayPal } from '../../policy/geopolicy.mjs';

export async function buildOffer(idea) {
    const price = idea.price_usd || 19.99;
    const maskEmail = (e) => {
        if (!e) return null;
        const parts = String(e).split('@');
        if (parts.length < 2) return e;
        const local = parts[0];
        const domain = parts[1];
        const maskedLocal = local.length <= 1 ? '*' : local[0] + '*'.repeat(Math.max(1, local.length - 1));
        return `${maskedLocal}@${domain}`;
    };
    
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
    let selectedRail = optimizer.selectRail(price, 'USD', 'MA', 'owner');
    const privacyStrict = String(process.env.PRIVACY_STRICT || '').toLowerCase() === 'true';
    const avoidPP = shouldAvoidPayPal();
    if (selectedRail === 'paypal' && avoidPP) {
        selectedRail = 'bank';
    }
    const preferCrypto = selectedRail === 'crypto';
    
    let paypalUrl = null;
    if (!avoidPP) {
        const params = new URLSearchParams({
            cmd: '_xclick',
            business: ownerPaypal,
            currency_code: 'USD',
            amount: price.toFixed(2),
            item_name: title,
            custom: offerId,
            return: 'https://www.realworldcerts.com/payment-success',
            cancel_return: 'https://www.realworldcerts.com/payment-cancel'
        });
        paypalUrl = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
    }

    const paymentOptions = [];
    if (paypalUrl) {
        paymentOptions.push({
            method: 'paypal',
            url: paypalUrl,
            badges: ['Verified', 'Secure', 'Buyer Protection']
        });
    }
    if (OWNER_ACCOUNTS.bank?.rib) {
        paymentOptions.push({
            method: 'bank',
            label: OWNER_ACCOUNTS.bank.label || 'Bank Wire',
            rib: OWNER_ACCOUNTS.bank.rib,
            instructions: `Make a bank transfer of $${price.toFixed(2)} USD to RIB ${OWNER_ACCOUNTS.bank.rib}. Add reference ${offerId}.`,
            badges: ['Verified', 'Secure']
        });
    }
    if (OWNER_ACCOUNTS.payoneer?.email || OWNER_ACCOUNTS.payoneer?.accountId) {
        const accountId = OWNER_ACCOUNTS.payoneer.accountId || null;
        const displayEmail = privacyStrict ? maskEmail(OWNER_ACCOUNTS.payoneer.email || null) : (OWNER_ACCOUNTS.payoneer.email || null);
        const target = accountId ? `ID ${accountId}` : (displayEmail || '');
        paymentOptions.push({
            method: 'payoneer',
            accountId,
            email: displayEmail,
            instructions: target ? `Send a Payoneer payment request to ${target}. Reference ${offerId}.` : `Send a Payoneer payment request. Reference ${offerId}.`,
            badges: ['Verified', 'Secure']
        });
    }

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
            paymentOptions.push({
                method: 'crypto',
                provider: 'binance',
                coin: 'USDT',
                network,
                address: address,
                tag: tag,
                instructions: `Send ${price.toFixed(2)} USDT to the address on ${network}. Include MEMO/TAG if provided.`,
                alternatives: cryptoOptions,
                badges: ['Secure', 'Verified Address']
            });
        }
    }
    if (OWNER_ACCOUNTS.crypto_erc20?.address) {
        paymentOptions.push({
            method: 'crypto',
            provider: 'wallet',
            coin: 'USDT',
            network: 'ETH',
            address: OWNER_ACCOUNTS.crypto_erc20.address,
            instructions: `Send ${price.toFixed(2)} USDT on ERC20 to ${OWNER_ACCOUNTS.crypto_erc20.address}.`,
            badges: ['Secure', 'Verified Address']
        });
    }
    if (OWNER_ACCOUNTS.crypto_bybit_erc20?.address) {
        paymentOptions.push({
            method: 'crypto',
            provider: 'bybit',
            coin: 'USDT',
            network: 'ETH',
            address: OWNER_ACCOUNTS.crypto_bybit_erc20.address,
            instructions: `Send ${price.toFixed(2)} USDT on ERC20 to ${OWNER_ACCOUNTS.crypto_bybit_erc20.address}.`,
            badges: ['Secure', 'Verified Address']
        });
    }
    if (OWNER_ACCOUNTS.crypto_bybit_ton?.address) {
        paymentOptions.push({
            method: 'crypto',
            provider: 'bybit',
            coin: 'TON',
            network: 'TON',
            address: OWNER_ACCOUNTS.crypto_bybit_ton.address,
            instructions: `Send ${price.toFixed(2)} TON to ${OWNER_ACCOUNTS.crypto_bybit_ton.address}.`,
            badges: ['Secure', 'Verified Address']
        });
    }
    
    const seenBank = new Set(paymentOptions.filter(p => p.method === 'bank').map(p => p.rib || p.identifier).filter(Boolean));
    const seenPayoneer = new Set(paymentOptions.filter(p => p.method === 'payoneer').map(p => p.email || p.accountId).filter(Boolean));
    const seenCrypto = new Set(paymentOptions.filter(p => p.method === 'crypto').map(p => p.address).filter(Boolean));
    for (const [key, acc] of Object.entries(OWNER_ACCOUNTS)) {
        if (!acc || acc.enabled === false) continue;
        if (acc.type === 'BANK_WIRE') {
            const rib = acc.rib || acc.identifier || null;
            if (rib && !seenBank.has(rib)) {
                paymentOptions.push({
                    method: 'bank',
                    label: acc.label || 'Bank Wire',
                    rib,
                    badges: ['Verified', 'Secure']
                });
                seenBank.add(rib);
            }
        } else if (acc.type === 'PAYONEER') {
            const id = acc.email || acc.accountId || null;
            if (id && !seenPayoneer.has(id)) {
                paymentOptions.push({
                    method: 'payoneer',
                    email: acc.email || null,
                    accountId: acc.accountId || null,
                    badges: ['Verified', 'Secure']
                });
                seenPayoneer.add(id);
            }
        } else if (acc.type === 'CRYPTO') {
            const addr = acc.address || null;
            if (addr && !seenCrypto.has(addr)) {
                let network = 'ETH';
                const n = String(key).toLowerCase();
                if (n.includes('ton')) network = 'TON';
                else if (n.includes('bep20') || n.includes('bsc')) network = 'BSC';
                paymentOptions.push({
                    method: 'crypto',
                    provider: acc.label && acc.label.toLowerCase().includes('bybit') ? 'bybit' : 'wallet',
                    coin: network === 'TON' ? 'TON' : 'USDT',
                    network,
                    address: addr,
                    badges: ['Secure', 'Verified Address']
                });
                seenCrypto.add(addr);
            }
        }
    }
    
    const primaryMethod = selectedRail === 'crypto' ? 'crypto' : (selectedRail === 'bank' ? 'bank' : (selectedRail === 'payoneer' ? 'payoneer' : (paypalUrl ? 'paypal' : 'bank')));
    let checkout = paypalUrl || null;
    if (!checkout) {
        const primary = paymentOptions.find(p => p.method === primaryMethod) || paymentOptions[0] || null;
        if (primary?.url) checkout = primary.url;
        else if (primary?.method === 'bank') checkout = `Bank Wire: ${OWNER_ACCOUNTS.bank.rib}`;
        else if (primary?.method === 'payoneer') checkout = `Payoneer: ${privacyStrict ? maskEmail(OWNER_ACCOUNTS.payoneer.email) : OWNER_ACCOUNTS.payoneer.email}`;
        else if (primary?.method === 'crypto' && primary?.address) checkout = `USDT ${primary.network}: ${primary.address}`;
        else checkout = paypalUrl || `Bank Wire: ${OWNER_ACCOUNTS.bank.rib}`;
    }

    return {
        idea_id: idea.id,
        offer_id: offerId,
        title: idea.title,
        price: price,
        currency: 'USD',
        checkout_url: checkout,
        timestamp: new Date().toISOString(),
        payment_method: primaryMethod,
        payment_options: paymentOptions
    };
}
