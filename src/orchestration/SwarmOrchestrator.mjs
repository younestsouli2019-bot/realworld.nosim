
import { AgentHealthMonitor } from '../swarm/health-monitor.mjs';
import { AdaptiveRateLimiter } from '../swarm/adaptive-rate-limiter.mjs';
import { FailureHandler } from '../swarm/failure-handler.mjs';
import { TaskManager } from '../swarm/task-manager.mjs';
import { GovernanceGate } from '../governance/GovernanceGate.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PowerRedundancyManager } from '../contingency/power-manager.mjs';
import { SmartSettlementOrchestrator } from '../financial/SmartSettlementOrchestrator.mjs';
import { CryptoGateway } from '../financial/gateways/CryptoGateway.mjs';
import { installAbility } from '../swarm/ability-fetcher.mjs';

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
    this.rateLimiter.registerLimit('MASTER_AGENT', 10, 1); // Master Agent lane
    
    // 2. Start Health Loop
    this.healthLoop();
    // 3. Process Owner Requests (one-shot + periodic)
    this.ownerRequestsLoop();
    // 4. Start Power Redundancy Monitoring
    this.powerManager = new PowerRedundancyManager({
      switchTimeoutMs: 30000,
      minRuntimeMinutes: 60,
      onAlert: (title, msg) => console.error(`⚡ ${title}: ${msg}`)
    });
    this.powerManager.start();
    
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

        await this._autoInstallAbilities(task, agentData);

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
  }

  async ownerRequestsLoop() {
    if (!this.active) return;
    try {
      await this.processOwnerHardwareFixProtocol();
      await this.processOwnerHealthFailureAndPowerPlan();
      await this.processOwnerResourceScaling();
      await this.processOutstandingTasks();
    } catch (e) {
      console.error('OwnerRequestsLoop error:', e.message);
    }
    setTimeout(() => this.ownerRequestsLoop(), 60000);
  }

  async processOwnerHardwareFixProtocol() {
    const requestPath = path.join(process.cwd(), 'owner.requests', 'request.txt');
    if (!fs.existsSync(requestPath)) return;
    const raw = fs.readFileSync(requestPath, 'utf8').trim();
    if (!raw) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      console.warn('Owner request.txt is not JSON; skipping processing.');
      return;
    }
    if (payload.type !== 'hardware_fix_protocol') return;

    const ts = Date.now();
    const reportsDir = path.join(process.cwd(), 'exports', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    let diagnostics = null;
    try {
      const out = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'system-diagnostics.mjs')], { encoding: 'utf8' });
      diagnostics = JSON.parse(out);
    } catch (e) {
      diagnostics = { ok: false, error: `diagnostics_failed: ${e.message}` };
    }

    const recommendations = this._buildRecommendations(diagnostics);
    const report = {
      ts: new Date(ts).toISOString(),
      protocol_version: payload.version || '1.0',
      mode: payload.mode || 'assisted',
      diagnostics,
      recommendations
    };

    const reportPath = path.join(reportsDir, `hardware_fix_report_${ts}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const ack = {
      status: 'processed',
      type: payload.type,
      processed_at: new Date(ts).toISOString(),
      report_path: path.relative(process.cwd(), reportPath)
    };
    const ackPath = path.join(process.cwd(), 'owner.requests', `ack_${ts}.json`);
    fs.writeFileSync(ackPath, JSON.stringify(ack, null, 2));
  }
  _parseAbilityMap() {
    const raw = process.env.ABILITIES_MAP_JSON || '';
    try {
      const j = JSON.parse(raw);
      if (j && typeof j === 'object') return j;
    } catch {}
    return {};
  }
  async _autoInstallAbilities(task, agentData) {
    const req = Array.isArray(task.requiredCapabilities) ? task.requiredCapabilities : [];
    if (req.length === 0) return;
    const have = Array.isArray(agentData.capabilities) ? agentData.capabilities : [];
    const map = this._parseAbilityMap();
    for (const cap of req) {
      if (have.includes(cap)) continue;
      const info = map[cap] || null;
      if (!info || !info.repo || !info.path) continue;
      const name = info.name || cap;
      try {
        await installAbility({ name, ownerRepo: info.repo, branch: info.branch || 'main', repoPath: info.path });
        agentData.capabilities.push(cap);
      } catch {}
    }
  }

  async processOutstandingTasks() {
    const requestPath = path.join(process.cwd(), 'owner.requests', 'request.txt');
    let doDispatch = false;
    if (fs.existsSync(requestPath)) {
      try {
        const raw = fs.readFileSync(requestPath, 'utf8').trim();
        if (raw) {
          const payload = JSON.parse(raw);
          doDispatch = payload.type === 'dispatch_outstanding';
        }
      } catch {}
    }
    const ts = Date.now();
    const reportsDir = path.join(process.cwd(), 'exports', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const receiptsDir = path.join(process.cwd(), 'exports', 'receipts');
    fs.mkdirSync(receiptsDir, { recursive: true });

    const cg = new CryptoGateway();
    const outDir = path.join(process.cwd(), 'settlements', 'crypto');
    const actions = [];
    if (fs.existsSync(outDir)) {
      const files = fs.readdirSync(outDir).filter(f => f.includes('_instruction_') && f.endsWith('.json'));
      for (const f of files) {
        try {
          const full = path.join(outDir, f);
          const j = JSON.parse(fs.readFileSync(full, 'utf8'));
          const provider = String(j.provider || '').toLowerCase();
          const status = String(j.status || '').toUpperCase();
          const dest = j.address;
          const amount = Number(j.amount || 0);
          if (status === 'WAITING_MANUAL_EXECUTION' && dest && amount > 0) {
            if (!doDispatch) {
              actions.push({ file: f, action: 'pending_manual', provider, amount });
              continue;
            }
            const tx = [{ amount, currency: 'USDT', destination: dest, reference: 'Outstanding Dispatch' }];
            const result = await cg.executeTransfer(tx, { provider });
            actions.push({ file: f, action: 'executed', provider, amount, status: result.status });
            const receiptPath = path.join(receiptsDir, `crypto_settlement_submitted_${Date.now()}.json`);
            fs.writeFileSync(receiptPath, JSON.stringify({ provider, destination: dest, amount, result }, null, 2));
            j.status = result.status?.toUpperCase() || 'SUBMITTED';
            j.executed_at = new Date().toISOString();
            fs.writeFileSync(full, JSON.stringify(j, null, 2));
          }
        } catch (e) {
          actions.push({ file: f, action: 'error', error: e.message });
        }
      }
    }

    const report = { ts: new Date(ts).toISOString(), kind: 'outstanding_tasks', actions };
    const reportPath = path.join(reportsDir, `outstanding_tasks_${ts}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const ack = { status: 'processed', type: doDispatch ? 'dispatch_outstanding' : 'scan_only', processed_at: new Date(ts).toISOString(), report_path: path.relative(process.cwd(), reportPath) };
    const ackPath = path.join(process.cwd(), 'owner.requests', `ack_${ts}.json`);
    fs.writeFileSync(ackPath, JSON.stringify(ack, null, 2));
  }
  async processOwnerResourceScaling() {
    const requestPath = path.join(process.cwd(), 'owner.requests', 'request.txt');
    if (!fs.existsSync(requestPath)) return;
    const raw = fs.readFileSync(requestPath, 'utf8').trim();
    if (!raw) return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.type !== 'owner_resource_scaling') return;

    const ts = Date.now();
    const reportsDir = path.join(process.cwd(), 'exports', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const scaling = {
      priority: ['owner_accounts_settlement', 'crypto_via_bitget', 'bank_or_payoneer', 'pc_procurement'],
      actions: []
    };

    let settlementResults = [];
    try {
      const amount = Number(payload.amount_usdt || 25);
      const sso = new SmartSettlementOrchestrator();
      settlementResults = await sso.routeAndExecute(amount, 'USDT');
      scaling.actions.push({ action: 'settlement_route_execute', amount_usdt: amount, results_count: settlementResults.length });
    } catch (e) {
      scaling.actions.push({ action: 'settlement_route_execute_failed', error: e.message });
    }

    const pcBudget = {
      considered: true,
      budget_usd: Number(payload.pc_budget_usd || 1200),
      funding_source: 'swarm_generated_revenue_or_external_clients',
      payment_routes: ['crypto', 'bank_wire', 'payoneer'],
      fulfillment: 'procure via swarm-held funds or clients paying vendor; owner accounts receive only',
      status: 'pending_funds'
    };

    const report = {
      ts: new Date(ts).toISOString(),
      scaling,
      settlement_results: settlementResults,
      pc_procurement: pcBudget
    };

    const reportPath = path.join(reportsDir, `owner_resource_scaling_${ts}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const ack = {
      status: 'processed',
      type: payload.type,
      processed_at: new Date(ts).toISOString(),
      report_path: path.relative(process.cwd(), reportPath)
    };
    const ackPath = path.join(process.cwd(), 'owner.requests', `ack_${ts}.json`);
    fs.writeFileSync(ackPath, JSON.stringify(ack, null, 2));
  }

  _buildRecommendations(d) {
    const recs = [];
    if (!d || d.ok === false) {
      recs.push('Run full hardware protocol manually: DNS flush, adapter reset, SFC, DISM, disk cleanup, reboot');
      return recs;
    }
    try {
      if (d.network && d.network.ok === false) {
        recs.push('Network unreachable: execute DNS flush and adapter reset (admin required)');
      }
      if (Array.isArray(d.disk?.probes)) {
        const slow = d.disk.probes.some(p => typeof p.write_probe_ms === 'number' && p.write_probe_ms > 200);
        if (slow) recs.push('Disk write probe slow: free space and cleanup temp files');
      }
      if (d.files && d.files.ok === false) {
        recs.push('Critical paths missing: recreate required directories/files and rerun diagnostics');
      }
      recs.push('Plan safe reboot after manual steps to apply fixes');
    } catch {
      recs.push('Recommendation build failed; follow full manual protocol steps');
    }
    return recs;
  }

  async processOwnerHealthFailureAndPowerPlan() {
    const requestPath = path.join(process.cwd(), 'owner.requests', 'request.txt');
    if (!fs.existsSync(requestPath)) return;
    const raw = fs.readFileSync(requestPath, 'utf8').trim();
    if (!raw) return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.type !== 'health_failure_report_and_power_plan') return;

    const ts = Date.now();
    const reportsDir = path.join(process.cwd(), 'exports', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    let diagnostics = null;
    try {
      const out = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'system-diagnostics.mjs')], { encoding: 'utf8' });
      diagnostics = JSON.parse(out);
    } catch (e) {
      diagnostics = { ok: false, error: `diagnostics_failed: ${e.message}` };
    }

    let memory = null;
    try {
      const memPath = path.join(process.cwd(), 'data', 'swarm-memory.json');
      memory = JSON.parse(fs.readFileSync(memPath, 'utf8'));
    } catch (e) {
      memory = null;
    }

    const healthFailures = [];
    try {
      await this.healthMonitor.checkHealth();
      for (const [agentId, data] of this.healthMonitor.agents) {
        if (data.status === 'UNHEALTHY' || data.status === 'DEAD') {
          healthFailures.push({
            agentId,
            status: data.status,
            lastHeartbeat: data.lastHeartbeat || 0,
            failures: data.failures || 0,
            severity: data.status === 'DEAD' ? 'critical' : 'high'
          });
        }
      }
    } catch {}

    const powerStatus = this.powerManager ? this.powerManager.getStatus() : null;

    const mitigation = [];
    if (diagnostics && diagnostics.network && diagnostics.network.ok === false) {
      mitigation.push({
        issue: 'network_unreachable',
        steps: ['ipconfig /flushdns', 'ipconfig /release', 'ipconfig /renew', 'netsh winsock reset', 'netsh int ip reset'],
        timeline: 'immediate',
        resources: ['admin privileges']
      });
    }
    if (diagnostics && Array.isArray(diagnostics.disk?.probes)) {
      const slow = diagnostics.disk.probes.some(p => typeof p.write_probe_ms === 'number' && p.write_probe_ms > 200);
      if (slow) {
        mitigation.push({
          issue: 'disk_write_slow',
          steps: ['cleanmgr /sagerun:1', 'clear %TEMP%'],
          timeline: 'same_day',
          resources: ['maintenance window']
        });
      }
    }
    mitigation.push({
      issue: 'power_outage_resilience',
      steps: ['procure UPS sized to load', 'install Automatic Transfer Switch', 'configure generator as secondary', 'enable monitoring and alerts', 'run failover drill'],
      timeline: '1-2 weeks',
      resources: ['UPS (1500-3000 VA)', 'ATS', 'Generator (3-5 kW)', 'electrician', 'monitoring software']
    });

    const implementationTimeline = [
      { phase: 'immediate', tasks: ['network reset', 'diagnostics rerun'] },
      { phase: 'same_day', tasks: ['disk cleanup', 'system repair (sfc, dism)'] },
      { phase: '1_week', tasks: ['UPS installation', 'ATS configuration', 'generator hookup'] },
      { phase: '2_weeks', tasks: ['monitoring integration', 'failover testing', 'audit documentation'] }
    ];

    let powerTest = null;
    try {
      const start = Date.now();
      this.powerManager.simulateOutage();
      await new Promise(r => setTimeout(r, 2000));
      const status1 = this.powerManager.getStatus();
      this.powerManager.simulateRestore();
      await new Promise(r => setTimeout(r, 2000));
      const status2 = this.powerManager.getStatus();
      powerTest = {
        outage_detected_at: status1.lastOutageAt || 0,
        failover_at: status1.lastFailoverAt || 0,
        delay_ms: (status1.lastFailoverAt || 0) - (status1.lastOutageAt || 0),
        restored_at: status2.lastRestoreAt || 0,
        within_30s: ((status1.lastFailoverAt || 0) - (status1.lastOutageAt || 0)) <= 30000
      };
    } catch (e) {
      powerTest = { ok: false, error: e.message };
    }

    const report = {
      ts: new Date(ts).toISOString(),
      health_failures: healthFailures,
      diagnostics,
      power_status: powerStatus,
      mitigation_strategies: mitigation,
      implementation_timeline: implementationTimeline,
      resource_requirements: ['admin privileges', 'maintenance window', 'UPS 1500-3000 VA', 'ATS', 'Generator 3-5 kW', 'electrician', 'monitoring'],
      power_failover_test: powerTest
    };

    const reportPath = path.join(reportsDir, `health_failure_and_power_plan_${ts}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const ack = {
      status: 'processed',
      type: payload.type,
      processed_at: new Date(ts).toISOString(),
      report_path: path.relative(process.cwd(), reportPath)
    };
    const ackPath = path.join(process.cwd(), 'owner.requests', `ack_${ts}.json`);
    fs.writeFileSync(ackPath, JSON.stringify(ack, null, 2));
  }

  stop() {
      this.active = false;
      console.log('🛑 Swarm Orchestrator Stopped.');
  }
}
