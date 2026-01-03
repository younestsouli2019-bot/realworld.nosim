// src/real/invariant-core.mjs

export class InvariantViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvariantViolationError';
    this.details = details;
  }
}

export class CompoundInvariantFailure extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CompoundInvariantFailure';
    this.details = details;
  }
}

export class InvariantCore {
  // IRREVERSIBLE INVARIANTS (cannot be changed at runtime)
  static #invariants = Object.freeze({
    MONEY_MOVED: 'money_moved',
    PROOF_EXISTS: 'proof_exists',
    PSP_CONFIRMED: 'psp_confirmed',
    RECIPIENT_AUTHORIZED: 'recipient_authorized',
    EVIDENCE_CHAINED: 'evidence_chained',
    NOT_SETTLED: 'not_settled',
    STATUS_VERIFIED: 'status_verified'
  });

  // HARD-CIRCUIT BREAKERS (throw → immediate system halt)
  static #circuitBreakers = new Map();

  /**
   * HARD ASSERT: If this throws, execution MUST stop.
   * No fallbacks, no recovery, no "try-catch and continue".
   */
  static assertInvariant(invariantName, condition, message) {
    if (!condition) {
      // TRIGGER CIRCUIT BREAKER
      this.#tripCircuitBreaker(invariantName);
      
      // LOG TO IMMUTABLE FAILURE LEDGER
      this.#logInvariantFailure({
        invariant: invariantName,
        timestamp: Date.now(),
        condition: String(condition),
        message
      });
      
      // THROW HARD STOP
      throw new InvariantViolationError(
        `INVARIANT_FAIL: ${invariantName} - ${message}`,
        { invariant: invariantName }
      );
    }
    
    // LOG SUCCESS TO AUDIT TRAIL
    this.#logInvariantSuccess(invariantName);
  }

  /**
   * TRIP CIRCUIT BREAKER: Once tripped, cannot be reset without restart
   */
  static #tripCircuitBreaker(invariantName) {
    this.#circuitBreakers.set(invariantName, {
      tripped: true,
      timestamp: Date.now(),
      resetPolicy: 'REQUIRES_RESTART'
    });

    // PROPAGATE BREAKER TRIP TO SYSTEM
    if (process.emit) {
        process.emit('invariant:circuit_tripped', invariantName);
    }
  }

  /**
   * CHECK IF ANY BREAKERS ARE TRIPPED (pre-execution)
   */
  static getTrippedBreakers() {
    return Array.from(this.#circuitBreakers.entries())
      .filter(([, state]) => state.tripped)
      .map(([name, state]) => ({ name, ...state }));
  }

  /**
   * REQUIRE ALL INVARIANTS: Bulk assertion
   */
  static async assertAllInvariants(event) {
    const invariants = [
      { name: 'event_missing', condition: !!event },
      { name: 'hallucination_check', condition: event.status !== 'hallucination' },
      { name: 'proof_missing', condition: !!event.verification_proof },
      { name: 'proof_type', condition: event.verification_proof?.type },
      { name: 'psp_id', condition: event.verification_proof?.psp_id },
      { name: 'amount_valid', condition: typeof event.verification_proof?.amount === 'number' },
      { name: 'currency', condition: !!event.verification_proof?.currency },
      { name: 'proof_timestamp', condition: !!event.verification_proof?.timestamp },
      { name: 'temporal_order', condition: () => {
        const proofTime = new Date(event.verification_proof.timestamp);
        const eventTime = new Date(event.created_at);
        return proofTime >= eventTime;
      }},
      { name: 'not_settled', condition: event.settled !== true },
      { name: 'status_verified', condition: event.status === 'VERIFIED' }
    ];

    // EXECUTE ALL INVARIANTS (no short-circuit, collect all failures)
    const failures = [];
    
    for (const invariant of invariants) {
      try {
        const condition = typeof invariant.condition === 'function' 
          ? invariant.condition()
          : invariant.condition;
          
        this.assertInvariant(invariant.name, condition, `Event ${event.id}`);
      } catch (error) {
        failures.push({ invariant: invariant.name, error });
      }
    }

    if (failures.length > 0) {
      // COMPOUND FAILURE - ALL FAILURES LOGGED
      throw new CompoundInvariantFailure(
        `Multiple invariants failed: ${failures.length}`,
        { failures }
      );
    }
  }

  // Placeholder for logging methods
  static #logInvariantFailure(data) {
    console.error(`[INVARIANT_FAILURE]`, JSON.stringify(data));
  }

  static #logInvariantSuccess(invariantName) {
    // console.debug(`[INVARIANT_PASS] ${invariantName}`);
  }
}

// GLOBAL PROCESS HANDLER FOR CIRCUIT BREAKERS
if (typeof process !== 'undefined') {
    process.on('invariant:circuit_tripped', (invariantName) => {
      console.error(`🚨 CIRCUIT BREAKER TRIPPED: ${invariantName}`);
      
      // IMMEDIATE SYSTEM RESPONSE
      setTimeout(() => {
        console.error('🛑 System entering fail-safe mode due to invariant violation');
        process.exit(1); // HARD STOP
      }, 1000);
    });
}
