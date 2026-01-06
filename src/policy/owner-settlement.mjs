import { MoneyMovedGate } from '../real/money-moved-gate.mjs';
import { SettlementLedger } from '../financial/SettlementLedger.mjs';
import { threatMonitor } from '../security/threat-monitor.mjs';
import { isPast72hUnsettled } from '../compliance/sla-enforcer.mjs';
import { isHardBindingActive } from './hard-binding.mjs';
import { OWNER_IDENTITY, OWNER_ACCOUNTS, ALLOWED_BENEFICIARIES } from './RecipientRegistry.mjs';
import { shouldAvoidPayPal } from './geopolicy.mjs';

export class OwnerSettlementEnforcer {
    static getOwnerIdentity() {
      return OWNER_IDENTITY;
    }

    static getOwnerAccounts() {
      // Convert Registry Object to Array format expected by legacy callers
      return [
        { type: 'bank', identifier: OWNER_ACCOUNTS.bank.rib, label: OWNER_ACCOUNTS.bank.label, priority: OWNER_ACCOUNTS.bank.priority, mode: 'RECEIVE_LIVE' },
        { type: 'bank', identifier: OWNER_ACCOUNTS.payoneer_uk_bank.identifier, label: OWNER_ACCOUNTS.payoneer_uk_bank.label, priority: OWNER_ACCOUNTS.payoneer_uk_bank.priority, mode: 'RECEIVE_LIVE' },
        { type: 'bank', identifier: OWNER_ACCOUNTS.payoneer_jp_bank.identifier, label: OWNER_ACCOUNTS.payoneer_jp_bank.label, priority: OWNER_ACCOUNTS.payoneer_jp_bank.priority, mode: 'RECEIVE_LIVE' },
        { type: 'bank', identifier: OWNER_ACCOUNTS.payoneer_eu_iban.identifier, label: OWNER_ACCOUNTS.payoneer_eu_iban.label, priority: OWNER_ACCOUNTS.payoneer_eu_iban.priority, mode: 'RECEIVE_LIVE' },
        { type: 'payoneer', identifier: OWNER_ACCOUNTS.payoneer.email, label: OWNER_ACCOUNTS.payoneer.label, priority: OWNER_ACCOUNTS.payoneer.priority, mode: 'RECEIVE_LIVE' },
        { type: 'crypto', identifier: OWNER_ACCOUNTS.crypto.address, label: OWNER_ACCOUNTS.crypto.label, priority: OWNER_ACCOUNTS.crypto.priority, mode: 'RECEIVE_LIVE' },
        { type: 'crypto', identifier: OWNER_ACCOUNTS.crypto_bybit_erc20.address, label: OWNER_ACCOUNTS.crypto_bybit_erc20.label, priority: OWNER_ACCOUNTS.crypto_bybit_erc20.priority, mode: 'RECEIVE_LIVE' },
        { type: 'crypto', identifier: OWNER_ACCOUNTS.crypto_bybit_ton.address, label: OWNER_ACCOUNTS.crypto_bybit_ton.label, priority: OWNER_ACCOUNTS.crypto_bybit_ton.priority, mode: 'RECEIVE_LIVE' },
        { type: 'payoneer', identifier: OWNER_ACCOUNTS.payoneer_secondary.email, label: OWNER_ACCOUNTS.payoneer_secondary.label, priority: OWNER_ACCOUNTS.payoneer_secondary.priority, mode: 'RECEIVE_LIVE' },
        { type: 'paypal', identifier: OWNER_ACCOUNTS.paypal.email, label: OWNER_ACCOUNTS.paypal.label, priority: OWNER_ACCOUNTS.paypal.priority, mode: 'RECEIVE_LIVE' }
      ];
    }
  
  static getOwnerAccountForType(type) {
    // Direct Registry Lookup
    const key = String(type).toLowerCase();
    
    // Direct match in registry
    if (OWNER_ACCOUNTS[key]) {
        const acc = OWNER_ACCOUNTS[key];
        // Return the identifier (RIB, Email, Address)
        return acc.rib || acc.email || acc.identifier || acc.address || acc.accountId;
    }

    // Legacy Fallback / Special Cases
    if (key === 'stripe') return OWNER_ACCOUNTS.stripe.rib;
    if (key.includes('erc20')) return OWNER_ACCOUNTS.crypto_erc20.address;
    if (key.includes('bep20') || key.includes('bsc')) return OWNER_ACCOUNTS.crypto.address;
    
    console.warn(`⚠️ No specific owner account for ${type}, defaulting to Bank.`);
    return OWNER_ACCOUNTS.bank.rib;
  }

    static isOwnerDestination(destination) {
      const d = String(destination || '').toLowerCase();
      // Check strict allowlist
      return ALLOWED_BENEFICIARIES.some(b => b.toLowerCase() === d);
    }


    static getPaymentConfiguration() {
      const basePriority = ['bank_transfer', 'crypto', 'payoneer', 'stripe', 'paypal'];
      const baseGateways = ['bank_transfer', 'payoneer', 'binance', 'stripe', 'paypal', 'crypto'];
      const effectivePriority = shouldAvoidPayPal() ? ['crypto', 'bank_transfer', 'payoneer', 'stripe', 'paypal'] : basePriority;
      const effectiveGateways = shouldAvoidPayPal() ? ['crypto', 'bank_transfer', 'payoneer', 'stripe'] : baseGateways;
      return {
        enabled: true,
        supported_gateways: effectiveGateways,
        settlement_priority: effectivePriority,
        auto_configuration: true,
        proof_generation: true,
        settlement_automation: true,
        owner_only_settlement: true,
        require_external_verification: true,
        settlement_destinations: {
          bank: OWNER_ACCOUNTS.bank.rib, // Priority 1: Attijari
          payoneer: OWNER_ACCOUNTS.payoneer.email, // Priority 2: Primary (Email preferred)
          payoneer_uk_bank: OWNER_ACCOUNTS.payoneer_uk_bank.identifier,
          payoneer_jp_bank: OWNER_ACCOUNTS.payoneer_jp_bank.identifier,
          payoneer_eu_iban: OWNER_ACCOUNTS.payoneer_eu_iban.identifier,
          crypto: OWNER_ACCOUNTS.crypto.address, // Priority 3: Trust Wallet (Primary)
          crypto_bybit_erc20: OWNER_ACCOUNTS.crypto_bybit_erc20.address, // Bybit (Secondary)
          crypto_bybit_ton: OWNER_ACCOUNTS.crypto_bybit_ton.address, // Bybit (TON)
          payoneer_secondary: OWNER_ACCOUNTS.payoneer_secondary.email, // Priority 4: Payoneer Secondary
          stripe: OWNER_ACCOUNTS.stripe.rib, // Priority 4: Stripe (via Bank)
          paypal: OWNER_ACCOUNTS.paypal.rib
        },
        credentials: {
          binance: {
            api_key: process.env.BINANCE_API_KEY,
            api_secret: process.env.BINANCE_API_SECRET ? '***SECURE***' : undefined,
            has_secret: !!process.env.BINANCE_API_SECRET
          },
          paypal: {
            client_id: process.env.PAYPAL_CLIENT_ID,
            has_secret: !!process.env.PAYPAL_SECRET
          },
          payoneer: {
            program_id: process.env.PAYONEER_PROGRAM_ID || '85538995',
            has_token: !!process.env.PAYONEER_TOKEN
          },
          stripe: {
            publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
            has_secret: !!process.env.STRIPE_SECRET_KEY
          }
        }
      };
    }
  
    static mapMethodToChannel(method) {
      if (method === 'bank') return 'BANK_WIRE';
      if (method === 'payoneer') return 'PAYONEER';
      if (method && method.startsWith('payoneer_')) return 'BANK_WIRE';
      if (method === 'paypal') return 'BANK_WIRE';
      if (method === 'stripe') return 'STRIPE';
      if (method && method.startsWith('crypto')) return 'TRUST_WALLET_DIRECT';
      return 'ANY';
    }

    static missingCredentials(method, config) {
      if (method === 'payoneer') {
        return !config.credentials?.payoneer?.has_token;
      }
      if (method === 'paypal') {
        return !config.credentials?.paypal?.client_id || !config.credentials?.paypal?.has_secret;
      }
      if (method === 'stripe') {
        return !config.credentials?.stripe?.has_secret;
      }
      return false;
    }

    /**
     * Enforces that the settlement destination is strictly an Owner Account.
     * @param {Object} event - The revenue event
     * @returns {Object} - The enforced settlement info
     */
    static enforceOwnerDestination(event) {
        const method = event.settlement_method || 'bank'; // Default to bank
        const destination = this.getOwnerAccountForType(method);
        const identity = this.getOwnerIdentity();

        return {
            destination_account: destination,
            destination_type: method,
            beneficiary_name: identity.name,
            beneficiary_id: identity.cin,
            owner_verified: true,
            enforced_by: 'OwnerSettlementEnforcer',
            proof_required: true, // PROOF IT ALL
            timestamp: new Date().toISOString()
        };
    }
  
    static async settleAllRecoveredEvents(events, manager) {
      console.log(`🔒 OwnerSettlementEnforcer: Processing ${events.length} events for STRICT OWNER SETTLEMENT.`);
      
      const ledger = new SettlementLedger();
      const config = this.getPaymentConfiguration();
      
      for (const event of events) {
        const settlementInfo = this.enforceOwnerDestination(event);
        const method = settlementInfo.destination_type;
        const channel = this.mapMethodToChannel(method);
        let status = 'approved';
        let extraMeta = {};
        
        if (isPast72hUnsettled(event)) {
          status = 'auto_failed_sla';
          extraMeta.sla_violation = true;
          const updates = {
            status,
            settlement_info: settlementInfo,
            metadata: {
              ...event.metadata,
              settlement_enforced: true,
              owner_allocation_verified: true,
              ...extraMeta
            }
          };
          if (manager && manager.storage) {
            await manager.storage.save('events', event.id, { ...event, ...updates });
            if (manager.audit) {
              await manager.audit.log(
                'SLA_AUTO_FAIL',
                event.id,
                null,
                settlementInfo,
                'OwnerSettlementEnforcer',
                { amount: event.amount, currency: event.currency }
              );
            }
          }
          console.log(`    💰 Allocated ${event.id} ($${event.amount}) -> OWNER (${settlementInfo.destination_type}: ${settlementInfo.destination_account}) [${updates.status}]`);
          continue;
        }
        
        if (threatMonitor.isBunkerMode()) {
          await ledger.queueTransaction(channel, Number(event.amount || 0), 'BUNKER_MODE');
          status = 'queued';
          extraMeta.queue_reason = 'BUNKER_MODE';
        } else if (this.missingCredentials(method, config)) {
          await ledger.queueTransaction(channel, Number(event.amount || 0), 'MISSING_CREDENTIALS');
          status = 'queued';
          extraMeta.queue_reason = 'MISSING_CREDENTIALS';
        } else {
          try {
            await MoneyMovedGate.assertMoneyMoved(event);
            status = 'approved';
          } catch (e) {
            const msg = e?.message || '';
            if (msg.includes('proof_missing') || isHardBindingActive()) {
              status = 'hallucination';
            } else {
              status = 'pending_verification';
            }
            extraMeta.verification_error = msg;
          }
        }
        
        const updates = {
            status,
            settlement_info: settlementInfo,
            metadata: {
                ...event.metadata,
                settlement_enforced: true,
                owner_allocation_verified: true,
                ...extraMeta
            }
        };

        if (manager && manager.storage) {
            await manager.storage.save('events', event.id, { ...event, ...updates });
            
            if (manager.audit) {
                await manager.audit.log(
                    'OWNER_ALLOCATION', 
                    event.id, 
                    null, 
                    settlementInfo, 
                    'OwnerSettlementEnforcer', 
                    { amount: event.amount, currency: event.currency }
                );
            }
        }

        console.log(`    💰 Allocated ${event.id} ($${event.amount}) -> OWNER (${settlementInfo.destination_type}: ${settlementInfo.destination_account}) [${updates.status}]`);
      }
    }
  }
