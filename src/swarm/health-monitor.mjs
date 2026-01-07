
import { globalRecorder } from './flight-recorder.mjs';

export class AgentHealthMonitor {
  constructor(checkInterval = 30000, options = {}) {
    this.agents = new Map(); // agentId -> {lastHeartbeat, failures, restartCount}
    this.checkInterval = checkInterval;
    this.onAlert = options.onAlert || null; // Callback for escalation
    this.recoveryStrategies = options.recoveryStrategies || new Map();
    this.persistentFailureCounts = new Map(); // agentId -> count
    this.softRestartThreshold = 2;
  }
  
  registerAgent(agentId, maxRestarts = 3) {
    this.agents.set(agentId, {
      lastHeartbeat: Date.now(),
      failures: 0,
      restartCount: 0,
      maxRestarts,
      status: 'HEALTHY'
    });
    globalRecorder.info(`[HealthMonitor] Agent registered: ${agentId}`);
  }
  
  heartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      if (agent.status !== 'HEALTHY') {
         globalRecorder.info(`[HealthMonitor] Agent recovered: ${agentId}`);
      }
      agent.failures = 0;
      agent.status = 'HEALTHY';
    }
  }
  
  async checkHealth() {
    const now = Date.now();
    for (const [agentId, data] of this.agents) {
      if (now - data.lastHeartbeat > 60000) { // 1 minute no heartbeat
        data.failures++;
        const pf = (this.persistentFailureCounts.get(agentId) || 0) + 1;
        this.persistentFailureCounts.set(agentId, pf);
        
        if (data.failures > 3) {
          data.status = 'UNHEALTHY';
          
          globalRecorder.warn(`[HealthMonitor] Agent UNHEALTHY: ${agentId} (Failures: ${data.failures})`);

          if (data.restartCount < data.maxRestarts) {
            await this.attemptRecovery(agentId, data);
            data.restartCount++;
            if (pf >= this.softRestartThreshold && this.onAlert) {
              this.onAlert('Persistent Failures', `Agent ${agentId} exceeded soft restart threshold; human investigation required`);
            }
          } else {
            data.status = 'DEAD';
            await this.escalateToHuman(agentId);
          }
        }
      }
    }
  }

  async attemptRecovery(agentId, data) {
    globalRecorder.recordDecision(
        `Recovering Agent ${agentId}`,
        `Failures: ${data.failures}, Restarts: ${data.restartCount}`,
        'Attempting restart/recovery strategy'
    );

    const strategy = this.recoveryStrategies.get(agentId);
    if (strategy) {
        try {
            await strategy();
            console.log(`[HealthMonitor] Custom recovery strategy executed for ${agentId}`);
        } catch (err) {
            console.error(`[HealthMonitor] Recovery strategy failed for ${agentId}:`, err);
        }
    } else {
        this.restartAgent(agentId);
    }
  }

  restartAgent(agentId) {
    console.log(`[HealthMonitor] Restarting agent ${agentId}...`);
    // In a real system, this would trigger a process restart or re-initialization
    // For now, we just log it as a "Soft Restart"
    globalRecorder.info(`[HealthMonitor] Soft Restart triggered for ${agentId}`);
  }

  async escalateToHuman(agentId) {
    const msg = `[HealthMonitor] CRITICAL: Agent ${agentId} is DEAD. Manual intervention required.`;
    console.error(msg);
    globalRecorder.error(msg);
    
    if (this.onAlert) {
        try {
            await this.onAlert("Agent Death Report", msg);
        } catch (e) {
            console.error("Failed to send alert:", e);
        }
    }
  }
}
