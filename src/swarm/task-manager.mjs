
class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(item, priority) {
        this.items.push({ item, priority });
        this.items.sort((a, b) => b.priority - a.priority);
    }

    dequeue() {
        return this.items.shift()?.item;
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

export class TaskManager {
  constructor(agents, healthMonitor, rateLimiter) {
    this.agents = agents; // Map of agentId -> { capabilities: string[] }
    this.healthMonitor = healthMonitor;
    this.rateLimiter = rateLimiter;
    this.taskQueue = new PriorityQueue();
    this.assignedTasks = new Map();
  }
  
  assignTask(task) {
    // Find available agents with required capability
    const capableAgents = [];
    
    for (const [agentId, agent] of this.agents) {
      if (this.hasCapability(agent, task.requiredCapabilities)) {
        const workload = this.assignedTasks.get(agentId)?.length || 0;
        const health = this.getAgentHealth(agentId);
        
        // Skip unhealthy agents
        if (health < 0.5) continue;

        capableAgents.push({
          agentId,
          workload,
          health,
          capabilityMatch: this.capabilityMatchScore(agent, task)
        });
      }
    }
    
    if (capableAgents.length === 0) {
      this.escalateTask(task);
      return null;
    }
    
    // Score agents (lower workload, better health = higher score)
    capableAgents.sort((a, b) => {
      const scoreA = (100 - a.workload) * a.health * a.capabilityMatch;
      const scoreB = (100 - b.workload) * b.health * b.capabilityMatch;
      return scoreB - scoreA;
    });
    
    // Check Rate Limits for the top candidate
    for (const candidate of capableAgents) {
        if (this.checkRateLimit(candidate.agentId, task)) {
            this.assignToAgent(task, candidate.agentId);
            return candidate.agentId;
        }
    }

    console.warn(`[TaskManager] All capable agents are rate-limited for task ${task.id}`);
    return null; // All candidates rate limited
  }

  checkRateLimit(agentId, task) {
      if (!this.rateLimiter) return true; // No limiter, proceed
      const resourceKey = task.resourceKey || 'DEFAULT';
      // We check global resource limits here. 
      // In future, we could check per-agent limits if AdaptiveRateLimiter supports it.
      return this.rateLimiter.tryAcquire(resourceKey);
  }
  
  hasCapability(agent, requiredCapabilities) {
      if (!requiredCapabilities) return true;
      return requiredCapabilities.every(cap => agent.capabilities.includes(cap));
  }

  getAgentHealth(agentId) {
      if (!this.healthMonitor) return 1.0;
      const agentData = this.healthMonitor.agents.get(agentId);
      if (!agentData) return 1.0; // Assume healthy if new
      
      // Calculate health score based on failures and status
      if (agentData.status === 'UNHEALTHY' || agentData.status === 'DEAD') return 0.0;
      return Math.max(0, 1.0 - (agentData.failures * 0.2));
  }

  escalateTask(task) {
      console.warn(`[TaskManager] No capable agent found for task: ${task.id}. Escalating.`);
  }

  assignToAgent(task, agentId) {
      if (!this.assignedTasks.has(agentId)) {
          this.assignedTasks.set(agentId, []);
      }
      this.assignedTasks.get(agentId).push(task);
      console.log(`[TaskManager] Assigned task ${task.id} to agent ${agentId}`);
  }

  capabilityMatchScore(agent, task) {
    if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) return 1;
    let score = 0;
    for (const cap of task.requiredCapabilities) {
      if (agent.capabilities.includes(cap)) score++;
    }
    return score / task.requiredCapabilities.length;
  }
}
