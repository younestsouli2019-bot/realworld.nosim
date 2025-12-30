import { globalRecorder } from './flight-recorder.mjs';

export class CircuitBreaker {
  constructor(failureThreshold = 5, resetTimeout = 60000) {
    this.failures = new Map();
    this.states = new Map(); // OPEN, HALF_OPEN, CLOSED
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }
  
  async call(operationName, fn) {
    const state = this.states.get(operationName) || 'CLOSED';
    
    if (state === 'OPEN') {
      // Check if reset timeout has passed
      const failureData = this.failures.get(operationName);
      if (failureData && Date.now() - failureData.lastFailure > this.resetTimeout) {
        this.states.set(operationName, 'HALF_OPEN');
        globalRecorder.info(`[CircuitBreaker] HALF_OPEN: ${operationName} (Probing...)`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${operationName}`);
      }
    }
    
    try {
      const result = await fn();
      
      // Success - close circuit if half-open
      if (state === 'HALF_OPEN') {
        this.states.set(operationName, 'CLOSED');
        this.failures.delete(operationName);
        globalRecorder.info(`[CircuitBreaker] CLOSED: ${operationName} (Recovered)`);
      }
      
      return result;
    } catch (error) {
      // Record failure
      const failureCount = (this.failures.get(operationName)?.count || 0) + 1;
      this.failures.set(operationName, {
        count: failureCount,
        lastFailure: Date.now(),
        lastError: error.message
      });
      
      // Open circuit if threshold reached
      if (failureCount >= this.failureThreshold) {
        if (state !== 'OPEN') {
           this.states.set(operationName, 'OPEN');
           globalRecorder.warn(`[CircuitBreaker] OPEN: ${operationName} (Failures: ${failureCount})`, { error: error.message });
        }
      }
      
      throw error;
    }
  }
}
