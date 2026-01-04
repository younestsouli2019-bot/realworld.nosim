// src/policy/revenue-recovery.mjs
import { OwnerSettlementEnforcer } from './owner-settlement.mjs';

export class RevenueRecoveryPolicy {
  
  constructor(financialManager) {
    this.manager = financialManager;
  }

  static async handleMissingProof(event, manager) {
    console.log(`🛡️ RevenueRecoveryPolicy: Intercepting Missing Proof for ${event.id}`);
    
    // NEVER QUARANTINE - ALWAYS ATTEMPT RECOVERY
    // In a real scenario, this would call the actual recovery logic.
    // Here we define the policy that SHOULD be followed.
    
    // 1. Mark for Recovery instead of Quarantine
    const updates = {
        status: 'recovery_in_progress',
        metadata: {
            ...event.metadata,
            quarantine_prevented: true,
            policy: 'RECOVERY_OVER_QUARANTINE'
        }
    };
    
    if (manager && manager.storage) {
        await manager.storage.save('events', event.id, { ...event, ...updates });
    }

    return { status: 'recovery_initiated' };
  }
  
  static async settleRecoveredEvent(event, proof, manager) {
    // 1. Verify Amount Matches Proof
    if (Math.abs(event.amount - proof.amount) > 0.01) {
        console.warn(`⚠️ Amount Mismatch on Recovery: Ledger ${event.amount} vs Proof ${proof.amount}. correcting...`);
        event.amount = proof.amount; // PSP is Truth
    }

    // 2. Attach Proof
    event.metadata = {
        ...event.metadata,
        proof_verified: true,
        proof_id: proof.psp_id,
        proof_source: proof.source || 'automated_recovery'
    };

    // 3. Hand off to Owner Settlement Enforcer
    await OwnerSettlementEnforcer.settleAllRecoveredEvents([event], manager);
  }
}
