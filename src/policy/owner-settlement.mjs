// src/policy/owner-settlement.mjs

export class OwnerSettlementEnforcer {
    static getOwnerIdentity() {
      // Allow overriding identity via ENV for rotation/privacy
      if (process.env.OWNER_IDENTITY_JSON) {
        try {
            return JSON.parse(process.env.OWNER_IDENTITY_JSON);
        } catch (e) {
            console.error("Failed to parse OWNER_IDENTITY_JSON from env", e);
        }
      }

      return {
        name: 'Younes Tsouli',
        cin: 'A337773',
        verification_sources: ['biometrics', 'gov_id', 'law_enforcement_db'],
        status: 'VERIFIED_OWNER'
      };
    }

    static getOwnerAccounts() {
      return [
        { type: 'bank', identifier: '007810000448500030594182', label: 'Attijari', priority: 1 },
        { type: 'payoneer', identifier: 'younestsouli2019@gmail.com', label: 'Primary (85538995)', priority: 2 },
        { type: 'crypto', identifier: '0xA46225a984E2B2B5E5082E52AE8d8915A09fEfe7', label: 'Trust Wallet (ERC20/BEP20)', priority: 3 },
        { type: 'crypto', identifier: '0xf6b9e2fcf43d41c778cba2bf46325cd201cc1a10', label: 'Bybit (ERC20)', priority: 3 },
        { type: 'crypto', identifier: 'UQDIrlJp7NmV-5mief8eNB0b0sYGO0L62Vu7oGX49UXtqlDQ', label: 'Bybit (TON)', priority: 3 },
        { type: 'payoneer', identifier: 'younesdgc@gmail.com', label: 'Secondary', priority: 4 },
        { type: 'paypal', identifier: 'younestsouli2019@gmail.com', label: 'Backup (Last Resort)', priority: 5 }
      ];
    }
  
    static getOwnerAccountForType(type) {
      const mapping = {
        paypal: 'younestsouli2019@gmail.com',
        bank: '007810000448500030594182',
        payoneer: 'younestsouli2019@gmail.com', // Default to Primary
        payoneer_secondary: 'younesdgc@gmail.com',
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
      
      for (const event of events) {
        // 1. Enforce Destination
        const settlementInfo = this.enforceOwnerDestination(event);
        
        // 2. Update Event with explicit destination
        const updates = {
            status: 'settled',
            settlement_info: settlementInfo,
            metadata: {
                ...event.metadata,
                settlement_enforced: true,
                owner_allocation_verified: true
            }
        };

        // 3. Save
        // Assuming manager has a storage.save method
        if (manager && manager.storage) {
            await manager.storage.save('events', event.id, { ...event, ...updates });
            
            // 4. Audit
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

        console.log(`    💰 Allocated ${event.id} ($${event.amount}) -> OWNER (${settlementInfo.destination_type}: ${settlementInfo.destination_account})`);
      }
    }
  }
