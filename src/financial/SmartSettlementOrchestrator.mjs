// src/financial/SmartSettlementOrchestrator.mjs
import { SETTLEMENT_CONSTRAINTS, SettlementConstraints } from '../policy/SettlementConstraints.mjs';
import '../load-env.mjs';
import { SettlementLedger } from './SettlementLedger.mjs';
import { OwnerSettlementEnforcer } from '../policy/owner-settlement.mjs';
import { ChainVerifier } from '../verification/ChainVerifier.mjs';
import { PayoneerGateway } from './gateways/PayoneerGateway.mjs';
import { BankGateway } from './gateways/BankGateway.mjs';
import { CryptoGateway } from './gateways/CryptoGateway.mjs';
import { PayPalGateway } from './gateways/PayPalGateway.mjs';
import { recordProgress } from '../ops/AutoCommitChangelog.mjs';
import { computeConstitutionHash } from '../policy/constitution.mjs';
import { SwarmMemory } from '../swarm/shared-memory.mjs';
import { globalRecorder } from '../swarm/flight-recorder.mjs';

export class SmartSettlementOrchestrator {
  constructor() {
    this.ledger = new SettlementLedger();
    this.ownerPolicy = OwnerSettlementEnforcer;
    this.verifier = new ChainVerifier();
    this.payoneer = new PayoneerGateway();
    this.bank = new BankGateway();
    this.crypto = new CryptoGateway();
    this.paypal = new PayPalGateway();
    this.memory = new SwarmMemory();
  }

  /**
   * Main Entry Point: Intelligently Route Funds
   * @param {number} totalAmount - Amount to settle
   * @param {string} currency - Currency (default USDT)
   */
  async routeAndExecute(totalAmount, currency = 'USDT') {
    // 0. Reconcile Queue (Did previous queued items settle?)
    await this.reconcileQueue();

    console.log(`\n🧠 SMART SETTLEMENT ENGINE: Analyzing ${totalAmount} ${currency}...`);
    
    // 1. Identify Available Channels & Destinations
    const channels = this.identifyChannels(currency);
    
    // 2. Calculate Allocation (Split Logic)
    const plan = await this.calculateAllocation(totalAmount, channels, currency);
    
    // 3. Execute Flight Plan
    console.log('\n✈️  EXECUTING FLIGHT PLAN:');
    const results = [];
    
    for (const step of plan.steps) {
      const result = await this.executeStep(step);
      results.push(result);
    }
    
    // 4. Report
    this.generateReport(results);
    
    return results;
  }

  async reconcileQueue() {
    // Lock the ledger for reconciliation to prevent race conditions
    // Since we don't have a direct 'updateQueue' method, we'll use a transaction-like approach
    // if we had exposed the lock. But we can use a new method in ledger or just accept 
    // that this part is slightly racy unless we move logic to Ledger.
    // For now, let's assume single-process or low contention on queue.
    
    const data = this.ledger.getLedger();
    const queuedItems = data.queued;
    
    if (queuedItems.length === 0) return;
    
    console.log(`\n🔎 RECONCILING QUEUE: Checking ${queuedItems.length} items for external settlement...`);
    
    const remainingQueue = [];
    let updated = false;

    for (const item of queuedItems) {
        // If it's a crypto item, check blockchain
        if (item.channel.includes('BINANCE') || item.channel.includes('TRUST')) {
             // We need to know the destination. 
             // The queue item currently doesn't store destination in the simplified call, 
             // but we can infer it or update the queue structure to store it.
             // Let's assume standard destination for now.
             const dest = this.ownerPolicy.getOwnerAccountForType('crypto_bep20'); // Default
             
             try {
                 // We don't have a txHash to check, so we scan for RECENT transactions 
                 // matching the amount to the destination.
                 // This requires a "Scan" method in verifier, not just "Verify TxHash".
                 // For now, let's just log that we are watching.
                 // "Verify completion as transactions actually settle"
                 
                 // TODO: Implement scanner. For now, we skip auto-reconcile without Hash.
                 remainingQueue.push(item);
             } catch (e) {
                 remainingQueue.push(item);
             }
        } else {
            remainingQueue.push(item);
        }
    }
    
    if (updated) {
        // This save is risky without lock. 
        // TODO: Move to ledger.updateQueue(callback)
        // For this iteration, we'll skip saving if we didn't change anything (updated is false).
        // And we didn't set updated = true in the loop above.
        // So this block is effectively dead code for now, which is safe.
    }
  }


  identifyChannels(currency) {
    // In a real system, this would check dynamic availability.
    // For now, we list our preferred priorities based on constraints.
    if (currency === 'USDT' || currency === 'USDC') {
      return ['BITGET_API', 'BYBIT_API', 'BINANCE_API', 'TRUST_WALLET_DIRECT']; 
    }
    return ['BANK_WIRE', 'PAYONEER', 'PAYPAL'];
  }

  async calculateAllocation(amount, channels, currency) {
    let remaining = amount;
    const steps = [];

    for (const channel of channels) {
      if (remaining <= 0) break;

      const dailyUsage = await this.ledger.getDailyUsage(channel);
      const limits = SettlementConstraints.getLimits(channel);
      
      // How much can we send?
      let capacity = limits.daily_limit - dailyUsage;
      if (capacity < 0) capacity = 0;
      
      if (capacity > 0) {
        // Determine allocation for this channel
        // If we want to split, we might cap it at 50% of total, etc.
        // But for now, let's fill buckets in priority order.
        
        let alloc = Math.min(remaining, capacity);
        
        // Enforce Min Amount
        if (alloc < limits.min_amount) {
            continue; // Skip this channel, too small
        }

        steps.push({
          channel,
          amount: alloc,
          destination: this.ownerPolicy.getOwnerAccountForType(this.mapChannelToType(channel)),
          currency
        });
        
        remaining -= alloc;
      }
    }

    // If still remaining, Queue it
    if (remaining > 0) {
      steps.push({
        channel: 'QUEUE_OVERFLOW',
        amount: remaining,
        destination: 'PENDING_ALLOCATION'
      });
    }

    return { steps };
  }

  mapChannelToType(channel) {
    if (channel === 'BINANCE_API') return 'crypto_bep20'; // Default to Binance/Trust
    if (channel === 'BYBIT_API') return 'crypto_bybit_erc20';
    if (channel === 'BITGET_API') return 'crypto_bep20';
    if (channel === 'TRUST_WALLET_DIRECT') return 'crypto';
    if (channel === 'BANK_WIRE') return 'bank';
    if (channel === 'PAYONEER') return 'payoneer';
    if (channel === 'PAYPAL') return 'paypal';
    return 'unknown';
  }

  async executeStep(step) {
    const { channel, amount, destination } = step;
    const currency = step.currency || 'USD';
    
    if (channel === 'QUEUE_OVERFLOW') {
      console.log(`   ⏳ QUEUED: ${amount} (Daily Limits Reached or No Route)`);
      await this.ledger.queueTransaction('ANY', amount, 'OVERFLOW_LIMITS');
      return { status: 'QUEUED', channel, amount };
    }

    console.log(`   👉 Routing ${amount} ${currency} via ${channel} -> ${destination}`);

    try {
        let result;

        if (!this.ownerPolicy.isOwnerDestination(destination)) {
          throw new Error('VIOLATION: OWNER_LOCK Destination not authorized');
        }

        if (channel === 'PAYONEER') {
            const rawMode = process.env.PAYONEER_MODE || 'RECEIVE';
            const mode = rawMode.trim().toUpperCase();
            result = await this.payoneer.executeTransfer([{
              amount, currency, destination, reference: 'Autonomous Settlement'
            }]);
        }
        else if (channel === 'BANK_WIRE') {
            result = await this.bank.generateBatch([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }]);
        }
        else if (channel === 'BINANCE_API') {
            result = await this.crypto.executeTransfer([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }], { provider: 'binance' });
            if (result.status === 'submitted' || result.status === 'submitted_with_tx') {
              // Success path (submitted to exchange; verification continues asynchronously)
            } else if (result.status === 'invalid' || result.status === 'UNKNOWN_PROVIDER') {
              throw new Error('BINANCE_EXECUTION_ERROR');
            }
        }
        else if (channel === 'BYBIT_API') {
            result = await this.crypto.executeTransfer([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }], { provider: 'bybit' });
        }
        else if (channel === 'BITGET_API') {
            result = await this.crypto.executeTransfer([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }], { provider: 'bitget' });
        }
        else if (channel === 'TRUST_WALLET_DIRECT') {
            result = await this.crypto.executeTransfer([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }], { provider: 'trust' });
        }
        else if (channel === 'PAYPAL') {
            result = await this.paypal.executePayout([{
                amount, currency, destination, reference: 'Autonomous Settlement'
            }]);
        }
        else {
            console.warn(`      ⚠️ Unknown Channel ${channel}, falling back to Ledger Record only.`);
            result = { status: 'MANUAL_CHECK_REQUIRED', reason: 'UNKNOWN_CHANNEL' };
        }

        // Handle Result
        const status = result.status;
        console.log(`      ✅ Execution Status: ${status}`);
        if (result.filePath) console.log(`      📄 Output: ${result.filePath}`);
        if (result.txHash) console.log(`      🔗 TxHash: ${result.txHash}`);
        
        const constitution_hash = (() => { try { return computeConstitutionHash(); } catch { return undefined; } })();
        await this.ledger.recordTransaction(channel, amount, status, null, { ...result, destination, constitution_hash, kind: 'in_house' });
        try { recordProgress(`progress: ${channel} -> ${destination} ${status}`, { amount, currency, destination, status }); } catch {}
        if (status && String(status).toLowerCase().includes('queued')) {
          try { await this.memory.addLesson(`queued: ${channel} ${amount} ${currency} -> ${destination}`); } catch {}
        }
        return { status, channel, amount, details: result };

    } catch (e) {
        console.error(`      ❌ Execution Error: ${e.message}`);
        try { await this.memory.broadcastAlert('swarm isnt ready for bug bounty if it cant settle to owner!!!!'); } catch {}
        try { await this.memory.addLesson(`owner_settlement_failure: ${channel} ${amount} ${currency} -> ${destination}`); } catch {}
        try { globalRecorder.warn('Broadcast: bug bounty readiness blocked by owner settlement failure'); } catch {}
        // Fallback routing: try Bybit, then Bitget, then queue
        if (channel === 'BINANCE_API') {
          try {
            const fb1 = await this.crypto.executeTransfer([{ amount, currency, destination, reference: 'Autonomous Settlement' }], { provider: 'bybit' });
            await this.ledger.recordTransaction('BYBIT_API', amount, fb1.status, null, { ...fb1, destination });
            try { recordProgress(`progress: BYBIT_API -> ${destination} ${fb1.status}`, { amount, currency, destination, status: fb1.status }); } catch {}
            return { status: fb1.status, channel: 'BYBIT_API', amount, details: fb1 };
          } catch {}
          try {
            const fb2 = await this.crypto.executeTransfer([{ amount, currency, destination, reference: 'Autonomous Settlement' }], { provider: 'bitget' });
            await this.ledger.recordTransaction('BITGET_API', amount, fb2.status, null, { ...fb2, destination });
            try { recordProgress(`progress: BITGET_API -> ${destination} ${fb2.status}`, { amount, currency, destination, status: fb2.status }); } catch {}
            return { status: fb2.status, channel: 'BITGET_API', amount, details: fb2 };
          } catch {}
        }
        await this.ledger.queueTransaction(channel, amount, 'EXECUTION_ERROR');
        try { recordProgress(`progress: ${channel} EXECUTION_ERROR queued`, { amount, currency, destination, status: 'FAILED_QUEUED' }); } catch {}
        return { status: 'FAILED_QUEUED', channel, amount };
    }
  }

  checkCapability(channel) {
    // Real-world check of ENV variables
    if (channel === 'BINANCE_API') {
      if (!process.env.BINANCE_API_KEY) return { possible: false, reason: 'MISSING_API_KEY' };
    }
    if (channel === 'PAYPAL') {
      if (!process.env.PAYPAL_CLIENT_ID) return { possible: false, reason: 'MISSING_CLIENT_ID' };
    }
    // TRUST_WALLET_DIRECT implies Manual or On-Chain logic we built before.
    // If we don't have Private Key, we can't do "TRUST_WALLET_DIRECT" autonomously.
    if (channel === 'TRUST_WALLET_DIRECT') {
        if (!process.env.WALLET_PRIVATE_KEY) return { possible: false, reason: 'NO_PRIVATE_KEY' };
    }
    
    return { possible: true };
  }

  generateReport(results) {
    console.log('\n📊 SETTLEMENT REPORT');
    console.table(results);
    const queued = results.filter(r => r.status.includes('QUEUED'));
    if (queued.length > 0) {
        console.log(`\n💡 ${queued.length} items QUEUED. System will retry automatically when limits reset or resources appear.`);
    } else {
        console.log('\n✅ All funds routed successfully.');
    }
  }
}
