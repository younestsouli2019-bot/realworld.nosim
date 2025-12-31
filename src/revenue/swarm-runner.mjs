import { MarketIntelligenceAgent } from './market-intelligence.mjs';
import { ProductSelectionEngine } from './product-scoring.mjs';
import fs from 'fs';
import path from 'path';

async function runRevenueSwarm() {
    console.log("🚀 Initializing SwarmCommerce AI...");

    // 1. Initialize Agents
    const marketAgent = new MarketIntelligenceAgent('./config/revenue-model.json');
    const scoringEngine = new ProductSelectionEngine(marketAgent.config);

    // 2. Execute Market Analysis
    const marketData = await marketAgent.analyzeMarket();
    
    // 3. Score and Select Products
    const scoredProducts = scoringEngine.scoreProducts(marketData);

    // 4. Output Results
    console.log("\n📊 Product Selection Report:");
    console.log("--------------------------------------------------");
    scoredProducts.forEach((p, i) => {
        console.log(`#${i+1} ${p.name}`);
        console.log(`   Score: ${p.selectionScore.toFixed(3)} | Verdict: ${p.verdict}`);
        console.log(`   Details: Demand=${p.demandScore.toFixed(2)}, Margin=${(p.estimatedMargin*100).toFixed(1)}%, Comp=${p.competitionIndex.toFixed(2)}`);
    });
    console.log("--------------------------------------------------");

    // 5. Save Report (Simulating persistent memory/reporting)
    const reportPath = path.join(process.cwd(), 'data', 'revenue-report-latest.json');
    fs.writeFileSync(reportPath, JSON.stringify(scoredProducts, null, 2));
    console.log(`\n💾 Report saved to ${reportPath}`);

    return {
        ok: true,
        marketDataSummary: {
            trendsTracked: marketData.length,
            demandSamples: marketData.length
        },
        selectedProductsCount: scoredProducts.length,
        topProduct: scoredProducts[0]?.name ?? null,
        reportPath
    };
}

// Allow direct execution
if (process.argv[1] === import.meta.filename) {
    runRevenueSwarm().catch(console.error);
}

export { runRevenueSwarm };
