import { buildBase44Client } from '../../base44-client.mjs';

export async function waitForPayment({ offer, timeoutHours = 48 }) {
    console.log(`⏳ Waiting for payment for: ${offer.title} (${offer.offer_id})`);
    
    try {
        const base44 = buildBase44Client();
        if (!base44) throw new Error("Base44 Client not configured");

        console.log("   Checking ledger for incoming funds...");
        
        // List recent revenue events to find a match
        // We look for the Offer ID in metadata or reconciliation_key
        const events = await base44.asServiceRole.entities.RevenueEvent.list("-created_date", 50);
        
        const match = events.find(e => {
            // Check metadata.custom_id (PayPal custom field)
            if (e.metadata?.custom_id === offer.offer_id) return true;
            // Check reconciliation_key
            if (e.reconciliation_key === offer.offer_id) return true;
            // Check notes for loose match
            if (e.notes && e.notes.includes(offer.offer_id)) return true;
            // Check metadata.offer_id
            if (e.metadata?.offer_id === offer.offer_id) return true;
            return false;
        });

        if (match) {
             console.log(`💰 PAYMENT CONFIRMED! Event: ${match.id}, Amount: ${match.amount} ${match.currency}`);
             return { confirmed: true, amount: match.amount, currency: match.currency, eventId: match.id };
        }

        console.log("   No matching payment found yet.");
        return { confirmed: false, reason: "No matching transaction found in ledger yet." };
        
    } catch (e) {
        console.error("   Error checking payment:", e.message);
        return { confirmed: false, reason: e.message };
    }
}
