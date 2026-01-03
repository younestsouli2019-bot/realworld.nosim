/**
 * UNIT ECONOMICS ENGINE
 * 
 * "Agents may NOT accept loss. Agents may NOT accept high fees. Agents may NOT accept negative margin."
 * 
 * This module is the FINAL GUARDRAIL against unprofitable actions.
 * It provides the "Hard Truth" about costs, fees, and net profit.
 */

const FEE_SCHEDULE = {
    paypal: {
        percent: 0.045, // 4.5% avg (3.49% + cross-border/currency)
        fixed: 0.49,    // $0.49 USD
        currency_conversion: 0.03 // 3% spread if needed
    },
    stripe: {
        percent: 0.029, // 2.9%
        fixed: 0.30     // $0.30 USD
    },
    payoneer: {
        percent: 0.01,  // ~1% receiving
        fixed: 0.00,
        withdrawal_fee: 0.02 // ~2% to bank
    },
    bank_wire: {
        percent: 0.00,
        fixed: 35.00    // $35 typical wire fee
    }
};

const MINIMUM_PROFIT_MARGIN = 0.15; // 15% Minimum Net Margin
const MINIMUM_NET_PROFIT_USD = 5.00; // $5.00 Absolute Minimum Profit

/**
 * Calculates the full economic breakdown of a proposed transaction.
 * @param {number} grossRevenue - The total amount the customer pays.
 * @param {number} cogs - Cost of Goods Sold (Product cost + Shipping).
 * @param {string} rail - 'paypal', 'stripe', 'payoneer', 'bank_wire'.
 * @param {number} adSpend - Attributed ad spend for this sale.
 */
export function calculateUnitEconomics(grossRevenue, cogs, rail = 'paypal', adSpend = 0) {
    const fees = FEE_SCHEDULE[rail] || FEE_SCHEDULE.paypal; // Default to PayPal if unknown
    
    // 1. Platform/Processing Fees
    const processingFee = (grossRevenue * fees.percent) + fees.fixed;
    
    // 2. Withdrawal/Conversion Cost (Estimate)
    // If the rail implies conversion (e.g. PayPal -> Local Bank), add that cost.
    const conversionCost = fees.currency_conversion ? (grossRevenue - processingFee) * fees.currency_conversion : 0;
    
    // 3. Total Direct Costs
    const totalCosts = cogs + processingFee + conversionCost + adSpend;
    
    // 4. Net Profit
    const netProfit = grossRevenue - totalCosts;
    const margin = grossRevenue > 0 ? (netProfit / grossRevenue) : 0;

    return {
        grossRevenue,
        costs: {
            cogs,
            processingFee,
            conversionCost,
            adSpend,
            total: totalCosts
        },
        netProfit,
        margin,
        rail,
        isProfitable: netProfit > 0,
        meetsMinimums: netProfit >= MINIMUM_NET_PROFIT_USD && margin >= MINIMUM_PROFIT_MARGIN
    };
}

/**
 * Throws an error if the transaction does not meet economic standards.
 * @param {object} economics - Result from calculateUnitEconomics
 */
export function enforceUnitEconomics(economics) {
    if (!economics.isProfitable) {
        throw new Error(`ECONOMICS VIOLATION: Transaction results in LOSS. Net: $${economics.netProfit.toFixed(2)}`);
    }

    if (!economics.meetsMinimums) {
        throw new Error(
            `ECONOMICS VIOLATION: Profit too low. ` +
            `Net: $${economics.netProfit.toFixed(2)} (${(economics.margin * 100).toFixed(1)}%). ` +
            `Min Required: $${MINIMUM_NET_PROFIT_USD} / ${(MINIMUM_PROFIT_MARGIN * 100).toFixed(0)}%`
        );
    }
    
    return true;
}

/**
 * Suggests optimizations if economics are poor.
 * @param {object} economics 
 */
export function suggestOptimizations(economics) {
    const suggestions = [];
    
    if (economics.costs.processingFee > economics.netProfit) {
        suggestions.push("CHANGE RAIL: Fees are eating >50% of profit. Try Bank Wire or Payoneer?");
    }
    
    if (economics.margin < 0.20 && economics.grossRevenue < 50) {
        suggestions.push("INCREASE PRICE: Low margin on low ticket item. Raise price by 20%.");
    }
    
    if (economics.costs.adSpend > economics.costs.cogs) {
        suggestions.push("CUT AD SPEND: CPA is higher than product cost.");
    }
    
    return suggestions;
}
