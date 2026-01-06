
import { getPayPalBalance } from '../paypal-api.mjs';
import { PayPalGateway } from '../financial/gateways/PayPalGateway.mjs';
import { CryptoGateway } from '../financial/gateways/CryptoGateway.mjs';
import { BankWireGateway } from '../financial/gateways/BankWireGateway.mjs';
import { PayoneerGateway } from '../financial/gateways/PayoneerGateway.mjs';
import { StripeGateway } from '../financial/gateways/StripeGateway.mjs';
import { shouldAvoidPayPal } from '../policy/geopolicy.mjs';
import { getEffectiveRoutes } from '../policy/route-optimizer.mjs';
import { broadcastCrypto } from '../financial/broadcast/CryptoBroadcaster.mjs';
import { prepareBankWire } from '../financial/broadcast/BankWireBroadcaster.mjs';
import { broadcastPayoneer } from '../financial/broadcast/PayoneerBroadcaster.mjs';
import { broadcastStripe } from '../financial/broadcast/StripeBroadcaster.mjs';
import { withRetry } from '../core/retry.mjs';
import { enforceOwnerSettlementForRoute } from '../security/constitution-enforcer.mjs';

export class ExternalGatewayManager {
  constructor(storage, auditLogger, executor) {
    this.storage = storage;
    this.audit = auditLogger;
    this.executor = executor;
    this.paypalGateway = new PayPalGateway();
    this.cryptoGateway = new CryptoGateway();
    this.bankGateway = new BankWireGateway();
    this.payoneerGateway = new PayoneerGateway();
    this.stripeGateway = new StripeGateway();
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

      if (shouldAvoidPayPal()) {
        const cryptoTx = recipientItems.map(item => ({
          amount: Number(item.amount),
          currency: item.currency || 'USD',
          destination: item.crypto_address || item.recipient_address || item.recipient_email,
          reference: item.note || `Batch ${payoutBatchId}`
        }));
        const cryptoResult = await this.cryptoGateway.executeTransfer(cryptoTx);
        this.audit.log('CRYPTO_TRANSFER_PREPARED', payoutBatchId, null, cryptoResult, actor);
        return {
          status: cryptoResult.status === 'prepared' ? 'processing' : 'processing',
          gateway_response: cryptoResult,
          payout_batch_id: payoutBatchId,
          processed_at: new Date().toISOString()
        };
      }

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
      if (shouldAvoidPayPal()) {
        const skipped = { disabled: true, reason: 'restricted_region' };
        this.audit.log('PAYPAL_BALANCE_SKIPPED', 'PAYPAL_ACCOUNT', null, skipped, actor);
        return skipped;
      }
      const balanceData = await getPayPalBalance();
      this.audit.log('FETCH_PAYPAL_BALANCE', 'PAYPAL_ACCOUNT', null, balanceData, actor);
      return balanceData;
    } catch (error) {
      console.error(`❌ Failed to fetch PayPal balance: ${error.message}`);
      throw error;
    }
  }

  /**
   * 4. Initiate Bank Wire Transfer (Explicit Rail)
   */
  async initiateBankWireTransfer(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    const context = { action: 'INITIATE_BANK_WIRE', actor, payoutBatchId };
    return this.executor.execute(idempotencyKey, async () => {
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error('No recipient items provided');
      }
      const tx = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_address || item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));
      const result = await withRetry(() => this.bankGateway.executeTransfer(tx));
      this.audit.log('BANK_WIRE_PREPARED', payoutBatchId, null, result, actor);
      return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: 'bank_transfer' };
    }, context);
  }

  /**
   * 5. Initiate Crypto Transfer (Explicit Rail)
   */
  async initiateCryptoTransfer(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    const context = { action: 'INITIATE_CRYPTO_TRANSFER', actor, payoutBatchId };
    return this.executor.execute(idempotencyKey, async () => {
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error('No recipient items provided');
      }
      const tx = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_address || item.crypto_address || item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));
      const result = await withRetry(() => this.cryptoGateway.executeTransfer(tx));
      this.audit.log('CRYPTO_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
      return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: 'crypto' };
    }, context);
  }

  /**
   * 6. Initiate Payoneer Transfer (Explicit Rail)
   */
  async initiatePayoneerTransfer(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    const context = { action: 'INITIATE_PAYONEER_TRANSFER', actor, payoutBatchId };
    return this.executor.execute(idempotencyKey, async () => {
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error('No recipient items provided');
      }
      const tx = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));
      const result = await withRetry(() => this.payoneerGateway.executeTransfer(tx));
      this.audit.log('PAYONEER_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
      return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: 'payoneer' };
    }, context);
  }

  /**
   * 7. Initiate Stripe Transfer (Explicit Rail)
   */
  async initiateStripeTransfer(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    const context = { action: 'INITIATE_STRIPE_TRANSFER', actor, payoutBatchId };
    return this.executor.execute(idempotencyKey, async () => {
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error('No recipient items provided');
      }
      const tx = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_address || item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));
      const result = await withRetry(() => this.stripeGateway.executeTransfer(tx));
      this.audit.log('STRIPE_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
      return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: 'stripe' };
    }, context);
  }

  async initiateAutoSettlement(payoutBatchId, recipientItems, idempotencyKey, actor = 'System') {
    const context = { action: 'INITIATE_AUTO_SETTLEMENT', actor, payoutBatchId };
    return this.executor.execute(idempotencyKey, async () => {
      if (!recipientItems || recipientItems.length === 0) {
        throw new Error('No recipient items provided');
      }
      const routes = getEffectiveRoutes(recipientItems[0]?.amount, recipientItems[0]?.currency || 'USD');
      const baseTx = recipientItems.map(item => ({
        amount: Number(item.amount),
        currency: item.currency || 'USD',
        destination: item.recipient_address || item.recipient_email || item.email,
        reference: item.note || `Batch ${payoutBatchId}`
      }));
      let lastError = null;
      for (const route of routes) {
        try {
          let result = null;
          if (route === 'bank_transfer') {
            const tx = enforceOwnerSettlementForRoute(route, baseTx);
            result = await withRetry(() => this.bankGateway.executeTransfer(tx));
            this.audit.log('BANK_WIRE_PREPARED', payoutBatchId, null, result, actor);
            return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: route };
          }
          if (route === 'crypto') {
            const tx = enforceOwnerSettlementForRoute(route, baseTx);
            result = await withRetry(() => this.cryptoGateway.executeTransfer(tx));
            this.audit.log('CRYPTO_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
            return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: route };
          }
          if (route === 'payoneer') {
            const tx = enforceOwnerSettlementForRoute(route, baseTx);
            result = await withRetry(() => this.payoneerGateway.executeTransfer(tx));
            this.audit.log('PAYONEER_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
            return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: route };
          }
          if (route === 'stripe') {
            const tx = enforceOwnerSettlementForRoute(route, baseTx);
            result = await withRetry(() => this.stripeGateway.executeTransfer(tx));
            this.audit.log('STRIPE_TRANSFER_PREPARED', payoutBatchId, null, result, actor);
            return { status: 'processing', gateway_response: result, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: route };
          }
          if (route === 'paypal') {
            if (shouldAvoidPayPal()) {
              continue;
            }
            const tx = enforceOwnerSettlementForRoute(route, baseTx);
            const paypalTx = tx.map(t => ({ amount: t.amount, currency: t.currency, destination: t.destination, reference: t.reference }));
            const resultPayPal = await withRetry(() => this.paypalGateway.executePayout(paypalTx));
            this.audit.log('PAYPAL_PAYOUT_EXECUTED', payoutBatchId, null, resultPayPal, actor);
            return { status: resultPayPal.status === 'IN_TRANSIT' ? 'success' : 'processing', gateway_response: resultPayPal, payout_batch_id: payoutBatchId, processed_at: new Date().toISOString(), route_attempted: route };
          }
        } catch (e) {
          lastError = e;
          this.audit.log('ROUTE_ATTEMPT_FAILED', payoutBatchId, null, { route, error: e.message }, actor);
          continue;
        }
      }
      if (lastError) throw lastError;
      throw new Error('No available routes');
    }, context);
  }

  async broadcastSettlement(route, prepared, transactions, actor = 'System') {
    if (route === 'bank_transfer') {
      const r = await withRetry(() => prepareBankWire(transactions));
      this.audit.log('BANK_WIRE_FILE_READY', prepared?.payout_batch_id || null, null, r, actor);
      return r;
    }
    if (route === 'crypto') {
      const r = await withRetry(() => broadcastCrypto(transactions));
      this.audit.log('CRYPTO_BROADCAST_RESULT', prepared?.payout_batch_id || null, null, r, actor);
      return r;
    }
    if (route === 'payoneer') {
      const r = await withRetry(() => broadcastPayoneer(transactions));
      this.audit.log('PAYONEER_BROADCAST_RESULT', prepared?.payout_batch_id || null, null, r, actor);
      return r;
    }
    if (route === 'stripe') {
      const r = await withRetry(() => broadcastStripe(transactions));
      this.audit.log('STRIPE_BROADCAST_RESULT', prepared?.payout_batch_id || null, null, r, actor);
      return r;
    }
    if (route === 'paypal') {
      return { status: 'prepared' };
    }
    return { status: 'unknown_route' };
  }
}
