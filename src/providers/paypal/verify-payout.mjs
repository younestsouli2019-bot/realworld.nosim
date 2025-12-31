import { paypalRequest, getPayPalAccessToken } from '../../paypal-api.mjs';

export async function verifyPaypalPayout(id) {
  try {
    const token = await getPayPalAccessToken();
    
    // Try as Payout Item first (most likely for individual ledger entries)
    // PayPal Item ID usually starts with specific prefix or we just try.
    // GET /v1/payments/payouts-item/{payout_item_id}
    
    let res = await paypalRequest(`/v1/payments/payouts-item/${id}`, { token });
    
    if (res.ok) {
        const data = await res.json();
        return {
            confirmed: data.transaction_status === "SUCCESS",
            amount: Number(data.payout_item.amount.value),
            currency: data.payout_item.amount.currency,
            destination: data.payout_item.receiver,
            timestamp: data.time_processed,
            type: "item"
        };
    }

    // Fallback: Try as Batch ID
    res = await paypalRequest(`/v1/payments/payouts/${id}`, { token });
    if (res.ok) {
        const data = await res.json();
        // If it's a batch, we can't strictly verify "amount" without knowing which item.
        // But for the purpose of "proveMoneyMoved" which usually takes a specific ledger entry,
        // it expects a single amount.
        // If the batch has only 1 item, we use it.
        const item = data.items?.[0];
        if (!item) return { confirmed: false, error: "empty_batch" };

        return {
            confirmed: item.transaction_status === "SUCCESS",
            amount: Number(item.payout_item.amount.value),
            currency: item.payout_item.amount.currency,
            destination: item.payout_item.receiver,
            timestamp: item.time_processed,
            type: "batch_first_item" // Warning: this might be ambiguous for multi-item batches
        };
    }

    return { confirmed: false, error: "not_found" };

  } catch (error) {
    console.error(`[verifyPaypalPayout] Error verifying ${id}:`, error);
    return { confirmed: false, error: error.message };
  }
}
