import { MoneyMovedGate } from '../real/money-moved-gate.mjs';
import { SettlementLedger } from '../financial/SettlementLedger.mjs';
import { threatMonitor } from '../security/threat-monitor.mjs';
import { isPast72hUnsettled } from '../compliance/sla-enforcer.mjs';
// src/policy/owner-settlement.mjs

export class OwnerSettlementEnforcer {
    static getOwnerIdentity() {
      // STRICT HARDCODED IDENTITY - NO ENV OVERRIDES ALLOWED
      return {
        name: 'Younes Tsouli',
        cin: 'A337773',
        verification_sources: ['biometrics', 'gov_id', 'law_enforcement_db'],
        status: 'VERIFIED_OWNER'
      };
    }

    static getOwnerAccounts() {
      return [
        { type: 'bank', identifier: '007810000448500030594182', label: 'Attijari', priority: 1, mode: 'RECEIVE' },
        { type: 'bank', identifier: 'Barclays:231486:15924956', label: 'Payoneer UK (Barclays)', priority: 2, mode: 'RECEIVE' },
        { type: 'bank', identifier: 'MUFG:0005:869:4671926', label: 'Payoneer JP (MUFG)', priority: 2, mode: 'RECEIVE' },
        { type: 'bank', identifier: 'LU774080000041265646', label: 'Payoneer EU (Banking Circle IBAN)', priority: 2, mode: 'RECEIVE' },
        { type: 'payoneer', identifier: 'younestsouli2019@gmail.com', label: 'Primary (85538995)', priority: 2, mode: 'RECEIVE' },
        { type: 'crypto', identifier: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7', label: 'Trust Wallet (ERC20/BEP20)', priority: 3, mode: 'RECEIVE' },
        { type: 'crypto', identifier: '0xf6b9e2fcf43d41c778cba2bf46325cd201cc1a10', label: 'Bybit (ERC20)', priority: 3, mode: 'RECEIVE' },
        { type: 'crypto', identifier: 'UQDIrlJp7NmV-5mief8eNB0b0sYGO0L62Vu7oGX49UXtqlDQ', label: 'Bybit (TON)', priority: 3, mode: 'RECEIVE' },
        { type: 'payoneer', identifier: 'younesdgc@gmail.com', label: 'Secondary', priority: 4, mode: 'RECEIVE' },
        { type: 'paypal', identifier: 'younestsouli2019@gmail.com', label: 'Backup (Last Resort)', priority: 5, mode: 'RECEIVE' }
      ];
    }
  
    static getOwnerAccountForType(type) {
      const mapping = {
        paypal: 'younestsouli2019@gmail.com',
        bank: '007810000448500030594182',
        payoneer: 'younestsouli2019@gmail.com', // Default to Primary
        payoneer_secondary: 'younesdgc@gmail.com',
        payoneer_uk_bank: 'Barclays:231486:15924956',
        payoneer_jp_bank: 'MUFG:0005:869:4671926',
        payoneer_eu_iban: 'LU774080000041265646',
        // Fallbacks
        stripe: '007810000448500030594182', // Settle Stripe to Bank
        crypto: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7', // Default to Trust Wallet
        crypto_erc20: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7',
        crypto_bep20: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7',
        crypto_bybit_erc20: '0xf6b9e2fcf43d41c778cba2bf46325cd201cc1a10',
        crypto_bybit_ton: 'UQDIrlJp7NmV-5mief8eNB0b0sYGO0L62Vu7oGX49UXtqlDQ'
      };
      
      if (!mapping[type]) {
        // Default to Bank (Priority 1) if unknown
        console.warn(`⚠️ No specific owner account for ${type}, defaulting to Bank (Attijari).`);
        return mapping['bank'];
      }
      
      return mapping[type];
    }

    static getPaymentConfiguration() {
      return {
        enabled: true,
        supported_gateways: ['bank_transfer', 'payoneer', 'binance', 'stripe', 'paypal'],
        settlement_priority: ['bank_transfer', 'payoneer', 'binance', 'stripe', 'paypal'], // Explicit Priority 1-5
        auto_configuration: true,
        proof_generation: true,
        settlement_automation: true,
        owner_only_settlement: true, // STRICT ENFORCEMENT
        require_external_verification: true, // PROOF IT ALL POLICY
        settlement_destinations: {
          bank: '007810000448500030594182', // Priority 1: Attijari
          payoneer: 'younestsouli2019@gmail.com', // Priority 2: Primary (Email preferred)
          payoneer_uk_bank: 'Barclays:231486:15924956',
          payoneer_jp_bank: 'MUFG:0005:869:4671926',
          payoneer_eu_iban: 'LU774080000041265646',
          crypto: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7', // Priority 3: Trust Wallet (Primary)
          crypto_bybit_erc20: '0xf6b9e2fcf43d41c778cba2bf46325cd201cc1a10', // Bybit (Secondary)
          crypto_bybit_ton: 'UQDIrlJp7NmV-5mief8eNB0b0sYGO0L62Vu7oGX49UXtqlDQ', // Bybit (TON)
          payoneer_secondary: 'younesdgc@gmail.com', // Priority 4: Payoneer Secondary
          stripe: '007810000448500030594182', // Priority 4: Stripe (via Bank)
          paypal: 'younestsouli2019@gmail.com' // Priority 5: Backup (Last Resort)
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
      if (method === 'paypal') return 'PAYPAL';
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
            if (msg.includes('proof_missing')) {
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
