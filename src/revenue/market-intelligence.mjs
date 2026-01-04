import fs from 'fs';
import path from 'path';

/**
 * Market Intelligence Agent
 * 
 * Responsibilities:
 * - Real-time trend monitoring (Heuristic Estimation)
 * - Competitor price tracking
 * - Seasonal demand forecasting
 * - Sentiment analysis
 */
export class MarketIntelligenceAgent {
    constructor(configPath) {
        this.id = 'market-intelligence-agent';
        this.config = this._loadConfig(configPath);
        
        // Initial test products for Phase 1 (including Digital Products from preserved instructions)
        this.monitoredProducts = [
            // Physical Products
            { id: 'p1', name: 'Customizable Canvas Tote Bag', category: 'Accessories' },
            { id: 'p2', name: 'Monogram Ceramic Coffee Mug', category: 'Home' },
            { id: 'p3', name: 'Customizable Phone Case', category: 'Electronics' },
            { id: 'p4', name: 'FNTCASE iPhone 17 Case', category: 'Electronics' },
            
            // Digital Products (Recovered from Agentic Commerce Protocol)
            { id: 'dig_001', name: 'Business Starter Kit (Templates)', category: 'Digital', type: 'digital_download' },
            { id: 'dig_002', name: 'AI Prompt Library (High Value)', category: 'Digital', type: 'digital_download' },
            { id: 'dig_art_01', name: 'Abstract AI Art Pack (50pcs)', category: 'Digital Art', type: 'digital_download' },
            { id: 'dig_ebook_01', name: '30-Day Mindfulness Challenge E-Book', category: 'Digital Books', type: 'digital_download' }
        ];
    }

    _loadConfig(configPath) {
        try {
            const fullPath = path.resolve(configPath || './config/revenue-model.json');
            if (fs.existsSync(fullPath)) {
                return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            }
        } catch (e) {
            console.error('[MarketIntel] Failed to load config:', e);
        }
        return {};
    }

    async analyzeMarket() {
        console.log(`[MarketIntel] Starting market analysis for ${this.monitoredProducts.length} products...`);
        const results = [];

        for (const product of this.monitoredProducts) {
            const trend = await this._getTrendVelocity(product);
            const seasonality = await this._getSeasonalityFactor(product);
            const sentiment = await this._getSentimentScore(product);
            
            // Demand Score = (trend_velocity * seasonality_factor * sentiment_score)
            const demandScore = trend * seasonality * sentiment;

            results.push({
                ...product,
                metrics: { trend, seasonality, sentiment },
                demandScore,
                timestamp: new Date().toISOString()
            });
        }

        return results;
    }

    // --- Market Signal Heuristics ---

    async _getTrendVelocity(product) {
        // STRICT NO-SIMULATION POLICY
        // Load from external data source or return neutral default
        const trends = this._loadTrendData();
        const productData = trends.trends[product.id] || trends.default;
        return productData.velocity;
    }

    async _getSeasonalityFactor(product) {
        // Deterministic Seasonality (Calendar-based is fine, it's not random)
        const month = new Date().getMonth();
        if (product.category === 'Accessories' && (month > 4 && month < 8)) return 1.3; // Summer
        if (month > 9) return 1.5; // Q4 Holiday
        return 1.0;
    }

    async _getSentimentScore(product) {
        // STRICT NO-SIMULATION POLICY
        const trends = this._loadTrendData();
        const productData = trends.trends[product.id] || trends.default;
        return productData.sentiment;
    }

    _loadTrendData() {
        try {
            const dataPath = path.resolve('./data/market/trends.json');
            if (fs.existsSync(dataPath)) {
                return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            }
        } catch (e) {
            console.warn('[MarketIntel] Failed to load trends.json, using defaults.');
        }
        return { trends: {}, default: { velocity: 1.0, sentiment: 0.5 } };
    }
}
