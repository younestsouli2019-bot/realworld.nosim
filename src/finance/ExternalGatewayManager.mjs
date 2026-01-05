
import { getPayPalBalance } from '../paypal-api.mjs';
import { PayPalGateway } from '../financial/gateways/PayPalGateway.mjs';

export class ExternalGatewayManager {
  constructor(storage, auditLogger, executor) {
    this.storage = storage;
    this.audit = auditLogger;
    this.executor = executor;
    this.paypalGateway = new PayPalGateway();
  }

  /**
   * 1. Initiate PayPal Payout
   * Wraps the PayPalGateway to send money, enforcing idempotency and audit logging.
   */
  async initiatePayPalPayout(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    // 1. Idempotency Check
    const context = { action: 'INITIATE_PAYPAL_PAYOUT', actor, payoutBatchId };
    
    return this.executor.execute(idempotencyKey, async () => {
      console.log(`💸 [GATEWAY] Initiating PayPal Payout Batch: ${payoutBatchId}`);

      // 2. Validation
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error("No recipient items provided for payout.");
      }

      // 3. Transform to Gateway Format
      // PayPalGateway expects: { amount, currency, destination }
      const transactions = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));

      // 4. Execute via Gateway
      // This handles the mode check (PAYOUT vs BILLING/INVOICE) internally
      const result = await this.paypalGateway.executePayout(transactions);

      // 5. Log Result
      this.audit.log('PAYPAL_PAYOUT_EXECUTED', payoutBatchId, null, result, actor);

      return {
        status: result.status === 'IN_TRANSIT' ? 'success' : 'processing', // Map to agent's expected status
        gateway_response: result,
        payout_batch_id: payoutBatchId,
        processed_at: new Date().toISOString()
      };
    }, context);
  }

  /**
   * 2. Update External Payout Status
   * Allows agents to report back status updates or manually intervene.
   */
  async updateExternalPayoutStatus(payoutItemId, newStatus, externalTransactionId = null, errorMessage = null, processedAt = null, actor = 'System') {
    // This typically updates the 'events' or 'payouts' record in storage
    // We'll search for the event/item by ID.
    
    // Try to load from events first (assuming Payout Items are stored as events or linked)
    // For this implementation, we'll assume we are updating an 'Event' which represents the payout item.
    let record = this.storage.load('events', payoutItemId);
    let type = 'events';

    if (!record) {
      // Try payouts (schedules) - unlikely but possible
      record = this.storage.load('payouts', payoutItemId);
      type = 'payouts';
    }

    if (!record) {
      throw new Error(`Payout Item ${payoutItemId} not found in storage.`);
    }

    const oldState = { ...record };
    
    // Update fields
    record.status = newStatus; // processing, success, failed, refunded, unclaimed
    record.updated_at = new Date().toISOString();
    
    if (externalTransactionId) {
      record.metadata = record.metadata || {};
      record.metadata.external_transaction_id = externalTransactionId;
      record.metadata.paypal_transaction_id = externalTransactionId; // Legacy compat
    }
    
    if (errorMessage) {
      record.metadata = record.metadata || {};
      record.metadata.last_error = errorMessage;
      record.error_message = errorMessage;
    }

    if (processedAt) {
      record.metadata = record.metadata || {};
      record.metadata.processed_at = processedAt;
    }

    // Save
    const saved = this.storage.save(type, payoutItemId, record);
    
    // Audit
    this.audit.log('UPDATE_PAYOUT_STATUS', payoutItemId, oldState, saved, actor, { newStatus, externalTransactionId });
    
    return saved;
  }

  /**
   * 3. Get PayPal Balance
   * Direct fetch from PayPal API.
   */
  async getPayPalBalance(actor = 'System') {
    console.log(`💰 [GATEWAY] Fetching PayPal Balance...`);
    try {
      const balanceData = await getPayPalBalance();
      this.audit.log('FETCH_PAYPAL_BALANCE', 'PAYPAL_ACCOUNT', null, balanceData, actor);
      return balanceData;
    } catch (error) {
      console.error(`❌ Failed to fetch PayPal balance: ${error.message}`);
      throw error;
    }
  }
}
