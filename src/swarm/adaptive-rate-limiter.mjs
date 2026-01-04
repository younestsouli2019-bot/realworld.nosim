
export class AdaptiveRateLimiter {
  constructor() {
    this.limits = new Map(); // key -> { tokens, lastRefill, maxTokens, refillRate }
    this.backoffs = new Map(); // key -> { failures, nextAttempt }
  }

  /**
   * Register a rate limit for a specific key (e.g., 'BINANCE_API', 'AGENT_123')
   * @param {string} key 
   * @param {number} maxTokens - Max requests burst
   * @param {number} refillRate - Tokens per second
   */
  registerLimit(key, maxTokens, refillRate) {
    this.limits.set(key, {
      tokens: maxTokens,
      lastRefill: Date.now(),
      maxTokens,
      refillRate
    });
  }

  /**
   * Check if a request can proceed.
   * @param {string} key 
   * @returns {boolean}
   */
  tryAcquire(key) {
    // 1. Check Backoff
    const backoff = this.backoffs.get(key);
    if (backoff && Date.now() < backoff.nextAttempt) {
      return false; // In backoff period
    }

    // 2. Refill Tokens
    const limit = this.limits.get(key);
    if (!limit) return true; // No limit registered

    const now = Date.now();
    const elapsed = (now - limit.lastRefill) / 1000;
    const tokensToAdd = elapsed * limit.refillRate;
    
    limit.tokens = Math.min(limit.maxTokens, limit.tokens + tokensToAdd);
    limit.lastRefill = now;

    // 3. Consume Token
    if (limit.tokens >= 1) {
      limit.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Report a success (clears backoff)
   */
  reportSuccess(key) {
    this.backoffs.delete(key);
  }

  /**
   * Report a failure (triggers exponential backoff)
   * @param {string} key 
   * @param {boolean} isRateLimitError - True if 429/Too Many Requests
   */
  reportFailure(key, isRateLimitError = false) {
    if (!isRateLimitError) return; // Only backoff on rate limits for now

    const current = this.backoffs.get(key) || { failures: 0, nextAttempt: 0 };
    current.failures += 1;
    
    // Exponential Backoff: 1s, 2s, 4s, 8s... max 60s
    const delay = Math.min(Math.pow(2, current.failures) * 1000, 60000);
    current.nextAttempt = Date.now() + delay;
    
    this.backoffs.set(key, current);
    console.log(`[RateLimiter] ${key} throttled. Backing off for ${delay}ms`);
  }
}
