
export class AgentHealthMonitor {
  constructor(checkInterval = 30000) {
    this.agents = new Map(); // agentId -> {lastHeartbeat, failures, restartCount}
    this.checkInterval = checkInterval;
  }
  
  registerAgent(agentId, maxRestarts = 3) {
    this.agents.set(agentId, {
      lastHeartbeat: Date.now(),
      failures: 0,
      restartCount: 0,
      maxRestarts,
      status: 'HEALTHY'
    });
  }
  
  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      agent.failures = 0;
      agent.status = 'HEALTHY';
    }
  }
  
  checkHealth() {
    const now = Date.now();
    for (const [agentId, data] of this.agents) {
      if (now - data.lastHeartbeat > 60000) { // 1 minute no heartbeat
        data.failures++;
        
        if (data.failures > 3) {
          data.status = 'UNHEALTHY';
          
          if (data.restartCount < data.maxRestarts) {
            this.restartAgent(agentId);
            data.restartCount++;
          } else {
            data.status = 'DEAD';
            this.escalateToHuman(agentId);
          }
        }
      }
    }
  }

  restartAgent(agentId) {
    console.log(`[HealthMonitor] Restarting agent ${agentId}...`);
    // In a real system, this would trigger a process restart or re-initialization
  }

  escalateToHuman(agentId) {
    console.error(`[HealthMonitor] CRITICAL: Agent ${agentId} is DEAD. Manual intervention required.`);
    // In a real system, this would send an alert
  }
}
