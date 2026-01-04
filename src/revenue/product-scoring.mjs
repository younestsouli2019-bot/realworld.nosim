/**
 * Product Selection Engine
 * 
 * Responsibilities:
 * - Score products based on multi-factor analysis
 * - Prioritize high margin / high demand items
 */
export class ProductSelectionEngine {
    constructor(config = {}) {
        this.id = 'product-selection-engine';
        this.targetMargin = config.target_margin || 0.35;
    }

    scoreProducts(marketData) {
        console.log(`[ProductScoring] Scoring ${marketData.length} opportunities...`);
        
        return marketData.map(item => {
            const demand = item.demandScore || 1.0;
            // STRICT NO-SIMULATION: Use item.margin if exists, else conservative default 0.2
            const margin = item.margin || 0.2; 
            const seasonality = item.metrics?.seasonality || 1.0;
            // STRICT NO-SIMULATION: Default competition 0.5 if unknown
            const competition = item.competition || 0.5; 

            // Scoring Algorithm:
            // Score = (Demand × 0.4) + (Margin × 0.3) + (Seasonality × 0.2) - (Competition × 0.1)
            // Normalized roughly to 0-1 scale, but can exceed 1
            const score = (demand * 0.4) + (margin * 0.3) + (seasonality * 0.2) - (competition * 0.1);

            return {
                ...item,
                estimatedMargin: margin,
                competitionIndex: competition,
                selectionScore: score,
                verdict: this._getVerdict(demand, margin)
            };
        }).sort((a, b) => b.selectionScore - a.selectionScore);
    }

    _getVerdict(demand, margin) {
        // Prioritization Matrix Logic
        const highDemand = demand > 1.2;
        const highMargin = margin > 0.3;

        if (highMargin && highDemand) return "TARGET (High Margin/High Demand)";
        if (highMargin && !highDemand) return "Niche (High Margin/Low Demand)";
        if (!highMargin && highDemand) return "Volume (Low Margin/High Demand)";
        return "Avoid (Low Margin/Low Demand)";
    }
}
