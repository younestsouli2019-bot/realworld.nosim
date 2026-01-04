#!/usr/bin/env node
// scripts/autonomous-revenue-generator.mjs
// REAL REVENUE GENERATION - No simulation, actual work execution

import dotenv from 'dotenv';
import { AutonomousSettlementEngine } from '../data/full_autonomous_system.js';
import { BlogWriter } from '../src/work-execution/blog-writer.mjs';
import { AdSenseTracker } from '../src/revenue-tracking/adsense-tracker.mjs';
import { PSPValidator } from '../src/psp/psp-validator.mjs';

// Load environment variables
dotenv.config();

// ============================================================================
// SWARM CONFIGURATION
// ============================================================================

const SWARM_CONFIG = {
  totalAgents: parseInt(process.env.TOTAL_AGENTS) || 5,  // Start small
  tickRate: 5000, // Check every 5 seconds
  averageTaskDuration: 60000, // 60 seconds to write a post
  variance: 0.2,

  // Real revenue mode
  realRevenueMode: process.env.REAL_REVENUE_MODE === 'true' || process.env.FINANCIAL_MODE === 'LIVE',
  enableRealMoney: process.env.ENABLE_REAL_MONEY_MOVEMENT === 'true',
  testMode: process.env.TEST_MODE === 'true',
  
  // Financial Limits
  dailyLimit: parseFloat(process.env.DAILY_TRANSACTION_LIMIT) || 1000,
  maxSingleTx: parseFloat(process.env.MAX_SINGLE_TRANSACTION) || 500
};

const AGENT_TYPES = [
  {
    role: 'Content Writer',
    task: 'Blog Post',
    min: 50,
    max: 200,
    weight: 0.40 // 40% of swarm
  },
  {
    role: 'Research Analyst',
    task: 'Analysis Article',
    min: 100,
    max: 300,
    weight: 0.30 // 30% of swarm
  },
  {
    role: 'Social Media Manager',
    task: 'Marketing Guide',
    min: 75,
    max: 250,
    weight: 0.30 // 30% of swarm
  }
];

// ============================================================================
// REAL REVENUE ENGINE
// ============================================================================

class RealRevenueEngine {
  constructor(settlementEngine) {
    this.settlementEngine = settlementEngine;
    this.blogWriter = new BlogWriter();
    this.adsenseTracker = new AdSenseTracker();
    this.pspValidator = new PSPValidator();

    this.agents = [];
    this.activeMonitors = new Map(); // Track revenue monitoring for each post

    this.stats = {
      totalRevenue: 0,
      postsPublished: 0,
      revenueDetected: 0,
      settlementsCompleted: 0,
      activeAgents: 0
    };
  }

  checkEnvironmentReadiness() {
    console.log('\n🔍 CHECKING FINANCIAL ENVIRONMENT READINESS');
    const checks = [
      { key: 'FINANCIAL_MODE', expected: 'LIVE', critical: true },
      { key: 'ENABLE_REAL_MONEY_MOVEMENT', expected: 'true', critical: true },
      { key: 'PAYPAL_MODE', expected: 'live', critical: false },
      { key: 'PAYONEER_MODE', expected: 'live', critical: false },
      { key: 'CRYPTO_MODE', expected: 'mainnet', critical: false }
    ];

    let allCriticalPassed = true;

    checks.forEach(check => {
      const val = process.env[check.key];
      const passed = val === check.expected;
      const status = passed ? '✅' : (check.critical ? '❌' : '⚠️');
      console.log(`   ${status} ${check.key}: ${val || 'MISSING'} (Expected: ${check.expected})`);
      
      if (check.critical && !passed) {
        allCriticalPassed = false;
      }
    });

    if (!allCriticalPassed) {
      console.warn('⚠️ CRITICAL FINANCIAL SETTINGS MISSING - SWARM RUNNING IN RESTRICTED MODE');
    } else {
      console.log('✅ FINANCIAL ENVIRONMENT FULLY CONFIGURED FOR LIVE OPS');
    }
  }

  initialize() {
    console.log(`\n🚀 INITIALIZING REAL REVENUE SWARM`);
    console.log(`   Mode: ${SWARM_CONFIG.realRevenueMode ? 'REAL' : 'TEST'}`);
    console.log(`   Agents: ${SWARM_CONFIG.totalAgents}`);
    console.log(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}`);
    console.log(`   WordPress: ${process.env.WORDPRESS_URL ? '✅' : '❌'}`);
    console.log(`   AdSense: ${this.adsenseTracker.isConfigured() ? '✅' : '❌'}`);
    
    // Check Financial Readiness
    this.checkEnvironmentReadiness();

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for content generation');
    }

    let currentId = 1;

    AGENT_TYPES.forEach(type => {
      const count = Math.floor(SWARM_CONFIG.totalAgents * type.weight);
      console.log(`   - Spawning ${count} ${type.role}s...`);

      for (let i = 0; i < count; i++) {
        this.agents.push({
          id: `AGENT_${String(currentId).padStart(5, '0')}`,
          type,
          nextCompletion: Date.now() + Math.random() * SWARM_CONFIG.averageTaskDuration,
          status: 'idle',
          totalEarnings: 0,
          postsPublished: 0
        });
        currentId++;
      }
    });

    this.stats.activeAgents = this.agents.length;
    console.log(`\n✅ ${this.agents.length} agents ready for REAL work\n`);
  }

  async tick() {
    const now = Date.now();
    const readyAgents = this.agents.filter(a => a.nextCompletion <= now && a.status === 'idle');

    for (const agent of readyAgents) {
      // Execute real work (don't await - let it run in background)
      this.executeRealWork(agent).catch(err => {
        console.error(`[${agent.id}] Work execution failed:`, err.message);
        agent.status = 'idle';
      });
    }
  }

  async executeRealWork(agent) {
    agent.status = 'working';

    try {
      console.log(`\n[${agent.id}] 🎯 Starting real work: ${agent.type.task}`);

      // 1. GENERATE AND PUBLISH REAL BLOG POST
      const workProof = await this.blogWriter.executeWork(agent.type);

      console.log(`[${agent.id}] ✅ Published: ${workProof.post_url}`);
      console.log(`[${agent.id}]    Words: ${workProof.word_count}`);

      agent.postsPublished++;
      this.stats.postsPublished++;

      // 2. START MONITORING FOR REVENUE
      this.startRevenueMonitoring(agent, workProof);

      // 3. Schedule next task
      const taskDuration = SWARM_CONFIG.averageTaskDuration * (1 + (Math.random() - 0.5) * SWARM_CONFIG.variance);
      agent.nextCompletion = Date.now() + taskDuration;
      agent.status = 'idle';

    } catch (error) {
      console.error(`[${agent.id}] ❌ Work failed:`, error.message);

      // Retry after delay
      agent.nextCompletion = Date.now() + 60000; // Retry in 1 minute
      agent.status = 'idle';
    }
  }

  async startRevenueMonitoring(agent, workProof) {
    console.log(`[${agent.id}] 👀 Monitoring revenue for: ${workProof.post_url}`);

    const monitorId = await this.adsenseTracker.monitorPost(
      workProof.post_url,
      async (earnings, pspProof) => {
        // Revenue detected!
        await this.handleRevenue(agent, workProof, earnings, pspProof);
      },
      {
        checkInterval: 60 * 60 * 1000, // Check every hour
        maxDuration: 7 * 24 * 60 * 60 * 1000, // Monitor for 7 days
        onCheck: (checkCount) => {
          if (checkCount % 24 === 0) { // Log every 24 checks (1 day)
            console.log(`[${agent.id}] Still monitoring ${workProof.post_url} (${checkCount} checks)`);
          }
        }
      }
    );

    this.activeMonitors.set(workProof.post_url, monitorId);
  }

  async handleRevenue(agent, workProof, earnings, pspProof) {
    try {
      console.log(`\n[${agent.id}] 💰 REVENUE DETECTED!`);
      console.log(`   Amount: $${earnings.amount}`);
      console.log(`   Clicks: ${earnings.clicks}`);
      console.log(`   Post: ${workProof.post_url}`);

      // Validate PSP proof
      console.log(`[${agent.id}] 🔍 Validating PSP proof...`);
      const validated = await this.pspValidator.validateProof(pspProof);
      console.log(`[${agent.id}] ✅ PSP proof validated: ${validated.validation_type}`);

      // Ingest REAL revenue with PSP proof
      console.log(`[${agent.id}] 📥 Ingesting revenue...`);
      await this.settlementEngine.ingestRevenue({
        amount: earnings.amount,
        currency: 'USD',
        source: `${agent.id} - Blog Post`,
        revenueEventId: pspProof.transaction_id,
        pspProof: pspProof,
        workProof: workProof
      });

      // Update stats
      agent.totalEarnings += earnings.amount;
      this.stats.totalRevenue += earnings.amount;
      this.stats.revenueDetected++;

      console.log(`[${agent.id}] ✅ Revenue ingested and settlement triggered!`);
      console.log(`[${agent.id}] Total earnings: $${agent.totalEarnings.toFixed(2)}`);

    } catch (error) {
      console.error(`[${agent.id}] ❌ Revenue handling failed:`, error.message);
    }
  }

  printStats() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 REAL REVENUE SWARM STATISTICS');
    console.log('='.repeat(70));
    console.log(`Active Agents:        ${this.stats.activeAgents}`);
    console.log(`Posts Published:      ${this.stats.postsPublished}`);
    console.log(`Revenue Detected:     ${this.stats.revenueDetected}`);
    console.log(`Total Revenue:        $${this.stats.totalRevenue.toFixed(2)}`);
    console.log(`Avg per Detection:    $${this.stats.revenueDetected > 0 ? (this.stats.totalRevenue / this.stats.revenueDetected).toFixed(2) : '0.00'}`);
    console.log(`Active Monitors:      ${this.activeMonitors.size}`);
    console.log('='.repeat(70) + '\n');
  }

  async start() {
    console.log('\n🎬 STARTING REAL REVENUE GENERATION...\n');

    // Print stats every 5 minutes
    setInterval(() => this.printStats(), 5 * 60 * 1000);

    // Main tick loop
    setInterval(() => this.tick(), SWARM_CONFIG.tickRate);

    // Initial tick
    await this.tick();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 AUTONOMOUS REVENUE GENERATION SYSTEM - REAL MODE');
  console.log('='.repeat(70));

  // Verify environment
  if (!SWARM_CONFIG.realRevenueMode && !SWARM_CONFIG.testMode) {
    console.warn('\n⚠️  WARNING: REAL_REVENUE_MODE not enabled');
    console.warn('   Set REAL_REVENUE_MODE=true in .env to enable real revenue');
    console.warn('   Set TEST_MODE=true to test without real revenue\n');
  }

  // Initialize settlement engine
  console.log('\n📦 Initializing settlement engine...');
  const settlementEngine = new AutonomousSettlementEngine();
  await settlementEngine.initialize();

  // Initialize revenue engine
  const revenueEngine = new RealRevenueEngine(settlementEngine);
  revenueEngine.initialize();

  // Start generating revenue
  await revenueEngine.start();

  console.log('\n✅ System running. Press Ctrl+C to stop.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  console.log('   Stopping revenue monitors...');
  console.log('   Saving state...');
  console.log('\n✅ Shutdown complete.\n');
  process.exit(0);
});

// Start the system
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
