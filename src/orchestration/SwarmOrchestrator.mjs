
import { AgentHealthMonitor } from '../swarm/health-monitor.mjs';
import { AdaptiveRateLimiter } from '../swarm/adaptive-rate-limiter.mjs';
import { FailureHandler } from '../swarm/failure-handler.mjs';
import { TaskManager } from '../swarm/task-manager.mjs';
import { GovernanceGate } from '../governance/GovernanceGate.mjs';

/**
 * THE MISSING LINK: Central Swarm Orchestration
 * Ties together Health, Rate Limits, and Failure Handling.
 */
export class SwarmOrchestrator {
  constructor() {
    this.healthMonitor = new AgentHealthMonitor(30000, {
      onAlert: (title, msg) => console.error(`🚨 ${title}: ${msg}`)
    });
    this.rateLimiter = new AdaptiveRateLimiter();
    this.failureHandler = new FailureHandler();
    this.taskManager = new TaskManager(new Map()); // Agents added dynamically
    this.governanceGate = new GovernanceGate()
    
    this.active = false;
  }

  /**
   * Initialize the Swarm
   */
  async start() {
    console.log('🐝 SWARM ORCHESTRATOR STARTING...');
    this.active = true;
    
    // 1. Initialize Default Limits
    this.rateLimiter.registerLimit('BINANCE_API', 10, 1); // 10 burst, 1/sec
    this.rateLimiter.registerLimit('PAYPAL_API', 5, 0.5); // 5 burst, 0.5/sec
    
    // 2. Start Health Loop
    this.healthLoop();
    
    console.log('✅ Swarm Orchestrator Active.');
  }

  /**
   * Register an Agent to be managed
   * @param {string} agentId 
   * @param {object} agentInstance - Must have execute(task) method
   * @param {string[]} capabilities 
   */
  registerAgent(agentId, agentInstance, capabilities = []) {
    this.healthMonitor.registerAgent(agentId);
    this.taskManager.agents.set(agentId, { instance: agentInstance, capabilities });
    console.log(`📝 Agent Registered: ${agentId} [${capabilities.join(', ')}]`);
  }

  /**
   * Execute a Task with Orchestration (Rate Limits + Retries)
   */
  async executeTask(task) {
    const taskId = task.id || `task_${Date.now()}`;
    task.id = taskId;
    
    const gov = this.governanceGate.evaluate(task)
    if (!gov.ok) return { status: 'BLOCKED_GOVERNANCE', reason: gov.reason }

    // 1. Assign Agent
    const agentId = this.taskManager.assignTask(task);
    if (!agentId) return { status: 'FAILED', reason: 'NO_AGENT_AVAILABLE' };

    // 2. Rate Limit Check (Resource based)
    const resourceKey = task.resourceKey || 'DEFAULT';
    if (!this.rateLimiter.tryAcquire(resourceKey)) {
        console.warn(`⏳ Rate Limit Hit for ${resourceKey}. Requeuing task ${taskId}`);
        return { status: 'RATE_LIMITED', retryAfter: 1000 };
    }

    // 3. Execution Wrapper
    try {
        console.log(`🚀 Executing Task ${taskId} on Agent ${agentId}...`);
        
        const agentData = this.taskManager.agents.get(agentId);
        if (!agentData || !agentData.instance) {
            throw new Error(`Agent ${agentId} instance not found`);
        }

        // REAL EXECUTION
        const result = await agentData.instance.execute(task);
        
        this.healthMonitor.heartbeat(agentId);
        this.rateLimiter.reportSuccess(resourceKey);
        
        return { status: 'COMPLETED', agentId, result };

    } catch (error) {
        // 4. Failure Handling
        const decision = this.failureHandler.handleFailure(task, error);
        
        if (decision.type === 'RETRY') {
             console.log(`♻️  Retrying task ${taskId} in ${decision.delay}ms`);
             // In real system: setTimeout(() => this.executeTask(task), decision.delay);
             return { status: 'RETRYING', delay: decision.delay };
        } else if (decision.type === 'DLQ') {
             return { status: 'DEAD_LETTER_QUEUED' };
        } else {
             return { status: 'FAILED_ABORTED' };
        }
    }
  }

  async healthLoop() {
    if (!this.active) return;
    await this.healthMonitor.checkHealth();
    setTimeout(() => this.healthLoop(), 30000);
  }

  stop() {
      this.active = false;
      console.log('🛑 Swarm Orchestrator Stopped.');
  }
}
