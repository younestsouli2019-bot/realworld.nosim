// src/policy/SettlementConstraints.mjs

export const SETTLEMENT_CONSTRAINTS = {
  // ----------------------------------------------------------------
  // CHANNEL LIMITS (INDIVIDUAL ACCOUNT TIER)
  // ----------------------------------------------------------------
  
  BANK_WIRE: {
    daily_limit: 10000, // $10k/day
    min_amount: 500,    // Don't wire less than $500 (Fees)
    processing_time: '1-3 business days',
    risk_factor: 'medium', // Flagged if too frequent
    currency: 'USD'
  },

  PAYONEER: {
    daily_limit: 2000,  // $2k/day withdrawal cap
    min_amount: 50,
    processing_time: 'instant',
    risk_factor: 'low',
    currency: 'USD'
  },

  BINANCE_API: {
    daily_limit: 50000, // Crypto withdrawal limit (Verified Level 1)
    rate_limit: '10 requests/min', // API constraint
    min_amount: 10,
    processing_time: 'minutes',
    risk_factor: 'low',
    currency: 'USDT'
  },

  PAYPAL: {
    daily_limit: 500,   // Strict limit for personal accounts
    transaction_limit: 500,
    min_amount: 1,
    processing_time: 'instant',
    risk_factor: 'high', // Prone to freezes
    currency: 'USD'
  },

  // ----------------------------------------------------------------
  // GLOBAL POLICIES
  // ----------------------------------------------------------------
  global_velocity_limit: 15000, // Max total outflow per day
  preferred_split_strategy: 'risk_adjusted', // Spread to avoid single-point failure
  
  // "Invisible Wall" - If balance exceeds this, force HELD state
  safety_cap: 25000 
};

export class SettlementConstraints {
  static getLimits(channel) {
    return SETTLEMENT_CONSTRAINTS[channel] || { daily_limit: 0, min_amount: 0 };
  }

  static canProcess(channel, amount, currentDailyUsage = 0) {
    const limits = this.getLimits(channel);
    if (amount < limits.min_amount) return { allowed: false, reason: 'BELOW_MINIMUM' };
    if (amount + currentDailyUsage > limits.daily_limit) return { allowed: false, reason: 'DAILY_LIMIT_EXCEEDED' };
    return { allowed: true };
  }
}
