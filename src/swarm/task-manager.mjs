
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
  constructor(agents) {
    this.agents = agents; // Map of agentId -> capability
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
        
        capableAgents.push({
          agentId,
          workload,
          health,
          capabilityMatch: this.capabilityMatchScore(agent, task)
        });
      }
    }
    
    if (capableAgents.length === 0) {
      // No capable agent - escalate
      this.escalateTask(task);
      return null;
    }
    
    // Score agents (lower workload, better health = higher score)
    capableAgents.sort((a, b) => {
      const scoreA = (100 - a.workload) * a.health * a.capabilityMatch;
      const scoreB = (100 - b.workload) * b.health * b.capabilityMatch;
      return scoreB - scoreA;
    });
    
    const selectedAgent = capableAgents[0];
    this.assignToAgent(task, selectedAgent.agentId);
    
    return selectedAgent.agentId;
  }
  
  hasCapability(agent, requiredCapabilities) {
      if (!requiredCapabilities) return true;
      return requiredCapabilities.every(cap => agent.capabilities.includes(cap));
  }

  getAgentHealth(agentId) {
      // In a real system, this would query the HealthMonitor
      return 1.0; // Assume healthy
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
