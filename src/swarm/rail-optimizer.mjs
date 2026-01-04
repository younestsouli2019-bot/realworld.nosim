import fs from 'fs';
import path from 'path';

export class RailOptimizer {
  constructor(options = {}) {
    this.statsPath = options.statsPath || path.join(process.cwd(), 'data', 'rail-stats.json');
    this.stats = this.loadStats() || {
      paypal: { success: 0, failure: 0, avgTime: 0, lastUsed: 0, consecutiveFailures: 0 },
      bank: { success: 0, failure: 0, avgTime: 0, lastUsed: 0, consecutiveFailures: 0 },
      payoneer: { success: 0, failure: 0, avgTime: 0, lastUsed: 0, consecutiveFailures: 0 },
      crypto: { success: 0, failure: 0, avgTime: 0, lastUsed: 0, consecutiveFailures: 0 }
    };
  }

  loadStats() {
    try {
      if (fs.existsSync(this.statsPath)) {
        return JSON.parse(fs.readFileSync(this.statsPath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load rail stats:', e);
    }
    return null;
  }

  saveStats() {
    try {
      const dir = path.dirname(this.statsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      console.error('Failed to save rail stats:', e);
    }
  }
  
  selectRail(amount, currency, country, recipientType) {
    // 0. Regulatory Override (Pre-emption)
    if (process.env.REGULATORY_CONTINGENCY_ACTIVE === 'true') {
        // Force Crypto if available, otherwise fallback to Bank (harder to freeze than PayPal)
        return 'crypto';
    }

    const candidates = [];
    
    // Score each rail
    for (const [rail, data] of Object.entries(this.stats)) {
      // Circuit Breaker Logic: Skip if too many consecutive failures (Adaptive Volatility)
      if (data.consecutiveFailures >= 3) {
         // Exponential backoff check could go here, for now just heavy penalty
         candidates.push({ rail, score: -1 }); 
         continue;
      }

      let score = 0;
      
      // Success rate (60% weight)
      const total = data.success + data.failure;
      const successRate = total > 0 ? data.success / total : 0.5;
      score += successRate * 0.6;
      
      // Speed (20% weight) - inverse of avg time
      const speedScore = data.avgTime > 0 ? 1 / (data.avgTime / 1000) : 0.5;
      score += speedScore * 0.2;
      
      // Recency (10% weight) - prefer recently used
      const hoursSinceUse = (Date.now() - data.lastUsed) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, 1 - (hoursSinceUse / 24));
      score += recencyScore * 0.1;
      
      // Cost (10% weight) - lower cost better
      const cost = this.estimateCost(rail, amount);
      const costScore = 1 - (cost / amount);
      score += Math.max(0, costScore) * 0.1;
      
      candidates.push({ rail, score });
    }
    
    // Return best rail, but randomize 10% to explore (only among positive scores)
    const validCandidates = candidates.filter(c => c.score > 0);
    if (validCandidates.length > 0) {
        if (Math.random() < 0.1) {
            return validCandidates[Math.floor(Math.random() * validCandidates.length)].rail;
        }
        return validCandidates.sort((a, b) => b.score - a.score)[0].rail;
    }
    
    // Fallback if all failing (Bank is Priority 1)
    return 'bank';
  }
  
  estimateCost(rail, amount) {
      // Simple cost estimation
      switch(rail) {
          case 'paypal': return amount; // ARTIFICIALLY HIGH COST to enforce "Last Resort"
          case 'bank': return 5; // Flat fee
          case 'payoneer': return 3; // Flat fee
          case 'crypto': return 1; // Very low fee (TRC20/BEP20)
          default: return amount * 0.1;
      }
  }

  recordResult(rail, success, processingTime) {
    const data = this.stats[rail];
    if (success) {
        data.success++;
        data.consecutiveFailures = 0; // Reset on success
    } else {
        data.failure++;
        data.consecutiveFailures = (data.consecutiveFailures || 0) + 1;
    }
    
    // Update average time
    data.avgTime = (data.avgTime * (data.success + data.failure - 1) + processingTime) / 
                   (data.success + data.failure);
    data.lastUsed = Date.now();
    
    this.saveStats(); // Persist immediately (Agentic Memory)
  }
}
