import { RailOptimizer } from './rail-optimizer.mjs';

export class LearningAgent {
  constructor(swarmMemory) {
    this.id = 'learning-agent';
    this.memory = swarmMemory;
    // We instantiate a reader-only optimizer to access shared stats
    this.railOptimizer = new RailOptimizer(); 
    this.memory.addObserver(this);
  }

  async learn() {
    // Refresh stats from disk (shared knowledge base)
    this.railOptimizer.stats = this.railOptimizer.loadStats() || this.railOptimizer.stats;
    const stats = this.railOptimizer.stats;

    // 1. Analyze Rail Performance & Adapt Policies
    for (const [rail, data] of Object.entries(stats)) {
       const total = data.success + data.failure;
       
       // Minimum sample size to form an opinion
       if (total < 5) continue;

       const failureRate = data.failure / total;
       const avgTime = data.avgTime;

       // Rule 1: High Failure Rate -> Enable Caution Mode
       // If > 20% fail, we mark the rail as "unstable" in Swarm Memory
       const keyUnstable = `policy:${rail}:unstable`;
       const isUnstable = this.memory.get(keyUnstable);

       if (failureRate > 0.2) {
           if (!isUnstable) {
               console.log(`[LearningAgent] 🧠 Detected high failure rate for ${rail}. Proposing instability flag.`);
               await this.memory.update(
                   keyUnstable, 
                   true, 
                   this.id, 
                   `High failure rate detected (${(failureRate*100).toFixed(1)}%)`
               );
           }
       } else if (failureRate < 0.1 && isUnstable) {
           // Recovery: If rate drops below 10%, remove flag
           console.log(`[LearningAgent] 🧠 ${rail} seems to have recovered. Proposing removal of instability flag.`);
           await this.memory.update(
               keyUnstable, 
               false, 
               this.id, 
               `Failure rate stabilized (${(failureRate*100).toFixed(1)}%)`
           );
       }

       // Rule 2: High Latency -> Adjust Timeout Expectations
       // If average time > 5000ms, suggest higher timeouts
       const keySlow = `policy:${rail}:slow_mode`;
       const isSlow = this.memory.get(keySlow);
       
       if (avgTime > 5000) {
           if (!isSlow) {
                await this.memory.update(
                   keySlow, 
                   true, 
                   this.id, 
                   `Average latency high (${Math.round(avgTime)}ms)`
               );
           }
       } else if (avgTime < 2000 && isSlow) {
            await this.memory.update(
               keySlow, 
               false, 
               this.id, 
               `Average latency normalized (${Math.round(avgTime)}ms)`
           );
       }
    }

    // 2. Analyze Swarm Health (Self-Healing)
    // We can check if specific agents are reporting too many errors in memory
    // (This relies on agents reporting to memory, which we'll assume happens via 'daemon-state')
    const daemonState = this.memory.get("daemon-state");
    if (daemonState && daemonState.consecutiveFailures > 5) {
        // System is struggling. Propose a "deep freeze" or "safe mode"
        const keySafeMode = `policy:global:safe_mode`;
        if (!this.memory.get(keySafeMode)) {
            console.log(`[LearningAgent] 🧠 System struggling (5+ failures). Proposing GLOBAL SAFE MODE.`);
            await this.memory.update(keySafeMode, true, this.id, "System instability detected");
        }
    }
  }
  
  // Observer interface for SwarmMemory
  async onProposal(proposal) {
      // The Learner validates proposals based on its "wisdom"
      // For now, it trusts other agents, but logs "insights"
      return true;
  }
}
