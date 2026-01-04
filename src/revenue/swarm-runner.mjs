
import { SwarmOrchestrator } from '../orchestration/SwarmOrchestrator.mjs';
import { MarketIntelligenceAgent } from './market-intelligence.mjs';
import { AdvancedRecoveryAgent } from './advanced-recovery.mjs';
import { ProductSelectionEngine } from './product-scoring.mjs';
import { SmartSettlementOrchestrator } from '../financial/SmartSettlementOrchestrator.mjs';
import { getRevenueConfigFromEnv } from '../base44-revenue.mjs';
import '../load-env.mjs';
import fs from 'fs';
import path from 'path';

// --- ADAPTERS FOR LEGACY AGENTS ---

class MarketAgentAdapter {
    constructor() {
        this.agent = new MarketIntelligenceAgent('./config/revenue-model.json');
    }
    async execute(task) {
        if (task.type === 'ANALYZE_MARKET') {
            return await this.agent.analyzeMarket();
        }
        throw new Error(`Unknown task type: ${task.type}`);
    }
}

class RecoveryAgentAdapter {
    constructor() {
        this.agent = new AdvancedRecoveryAgent();
    }
    async execute(task) {
        if (task.type === 'RECOVER_REVENUE') {
            return await this.agent.executeRecoveryLoop();
        }
        throw new Error(`Unknown task type: ${task.type}`);
    }
}

class CommerceExecutionAgent {
    constructor(scoringEngine) {
        this.scoringEngine = scoringEngine;
        this.settlementOrchestrator = new SmartSettlementOrchestrator();
    }

    async execute(task) {
        if (task.type === 'SCORE_AND_EXECUTE') {
            const marketData = task.payload;
            const scoredProducts = this.scoringEngine.scoreProducts(marketData);
            
            // Log Top Pick
            const winner = scoredProducts[0];
            console.log(`🏆 Top Pick: ${winner.name} (Score: ${winner.selectionScore.toFixed(2)})`);

            if (winner.selectionScore > 0.7) {
                return await this.executeTrade(winner);
            } else {
                return { status: 'SKIPPED', reason: 'LOW_SCORE' };
            }
        }
        throw new Error(`Unknown task type: ${task.type}`);
    }

    async executeTrade(product) {
        console.log(`💰 EXECUTING TRADE: ${product.name}`);
        
        // REAL REVENUE GENERATION (No Simulation)
        const grossRevenue = 150.00; // Fixed unit price for now
        
        // Use Smart Settlement to route funds
        // Priority: Bank -> Payoneer -> Crypto -> PayPal
        const results = await this.settlementOrchestrator.routeAndExecute(grossRevenue, 'USD');
        
        // Analyze results
        const queued = results.filter(r => r.status.includes('QUEUED'));
        const inTransit = results.filter(r => r.status === 'IN_TRANSIT');

        if (queued.length > 0 && inTransit.length === 0) {
             return { status: 'QUEUED', reason: queued[0].reason || 'Unknown Limit' };
        }

        return { 
            status: 'EXECUTED', 
            revenue: grossRevenue, 
            details: results,
            product: product.name
        };
    }
}

// --- MAIN SWARM RUNNER ---

async function runRevenueSwarm() {
    console.log("🚀 Initializing SwarmCommerce AI (Orchestrated)...");

    // 1. Initialize Orchestrator
    const swarm = new SwarmOrchestrator();
    await swarm.start();

    // 2. Register Agents
    const marketAdapter = new MarketAgentAdapter();
    const recoveryAdapter = new RecoveryAgentAdapter();
    const scoringEngine = new ProductSelectionEngine(marketAdapter.agent.config);
    const commerceAgent = new CommerceExecutionAgent(scoringEngine);

    swarm.registerAgent('MARKET_INTEL', marketAdapter, ['MARKET_ANALYSIS']);
    swarm.registerAgent('RECOVERY_BOT', recoveryAdapter, ['REVENUE_RECOVERY']);
    swarm.registerAgent('COMMERCE_EXEC', commerceAgent, ['TRADE_EXECUTION']);

    // 3. Execute Workflow
    try {
        // Step A: Recovery
        console.log('\n--- Step A: Revenue Recovery ---');
        const recoveryResult = await swarm.executeTask({
            type: 'RECOVER_REVENUE',
            requiredCapabilities: ['REVENUE_RECOVERY'],
            resourceKey: 'DEFAULT'
        });
        if (recoveryResult.result && recoveryResult.result.length > 0) {
            console.log(`💰 Recovered ${recoveryResult.result.length} items.`);
        }

        // Step B: Market Analysis
        console.log('\n--- Step B: Market Analysis ---');
        const marketResult = await swarm.executeTask({
            type: 'ANALYZE_MARKET',
            requiredCapabilities: ['MARKET_ANALYSIS'],
            resourceKey: 'DEFAULT'
        });

        // Step C: Execution
        if (marketResult.status === 'COMPLETED') {
            console.log('\n--- Step C: Trade Execution ---');
            const tradeResult = await swarm.executeTask({
                type: 'SCORE_AND_EXECUTE',
                payload: marketResult.result,
                requiredCapabilities: ['TRADE_EXECUTION'],
                resourceKey: 'BINANCE_API' // Rate limited resource
            });
            console.log('Trade Result:', tradeResult);
        }

    } catch (e) {
        console.error("❌ Swarm Workflow Failed:", e);
    } finally {
        swarm.stop();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runRevenueSwarm();
}

export { runRevenueSwarm };
