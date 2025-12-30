
export class RailOptimizer {
  constructor() {
    this.stats = {
      paypal: { success: 0, failure: 0, avgTime: 0, lastUsed: 0 },
      bank: { success: 0, failure: 0, avgTime: 0, lastUsed: 0 },
      payoneer: { success: 0, failure: 0, avgTime: 0, lastUsed: 0 }
    };
  }
  
  selectRail(amount, currency, country, recipientType) {
    const candidates = [];
    
    // Score each rail
    for (const [rail, data] of Object.entries(this.stats)) {
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
    
    // Return best rail, but randomize 10% to explore
    if (Math.random() < 0.1) {
      return candidates[Math.floor(Math.random() * candidates.length)].rail;
    }
    
    return candidates.sort((a, b) => b.score - a.score)[0].rail;
  }
  
  estimateCost(rail, amount) {
      // Simple cost estimation
      switch(rail) {
          case 'paypal': return Math.min(amount * 0.02, 20); // 2% capped
          case 'bank': return 5; // Flat fee
          case 'payoneer': return 3; // Flat fee
          default: return amount * 0.1;
      }
  }

  recordResult(rail, success, processingTime) {
    const data = this.stats[rail];
    if (success) data.success++;
    else data.failure++;
    
    // Update average time
    data.avgTime = (data.avgTime * (data.success + data.failure - 1) + processingTime) / 
                   (data.success + data.failure);
    data.lastUsed = Date.now();
  }
}
