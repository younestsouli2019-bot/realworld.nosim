// File: src/game/RevenueScoringEngine.mjs
/**
 * Game Scoring System - Treats revenue like video game points
 */

import { ElectricRewardsEngine } from '../rewards/ElectricRewardsEngine.mjs';
import { RealValueRewards } from '../rewards/RealValueRewards.mjs';

export class RevenueScoringEngine {
  constructor() {
    this.ownerAccount = 'Younes Tsouli';
    this.agents = new Map(); // Agent ID -> Score
    this.leaderboard = [];
    this.transactions = [];
    this.gameState = 'LIVE'; // NO SANDBOX, NO TEST
    
    // Initialize Reward Engines
    this.electricEngine = new ElectricRewardsEngine();
    this.valueRewards = new RealValueRewards();
  }

  async scoreTransaction(transaction) {
    console.log(`🎮 Scoring attempt: ${transaction.id}`);
    
    // RULE 1: Must be REAL money
    if (!this.isRealMoney(transaction)) {
      console.log('❌ Not real money - no points');
      return { score: 0, reason: 'not_real_money' };
    }
    
    // RULE 2: Must reach OWNER account
    if (!await this.reachedOwnerAccount(transaction)) {
      console.log('❌ Money not in OWNER account');
      return { score: 0, reason: 'not_in_owner_account' };
    }
    
    // RULE 3: Must be provider-confirmed
    if (!transaction.provider_confirmation) {
      console.log('❌ No provider confirmation');
      return { score: 0, reason: 'unconfirmed' };
    }
    
    // Calculate base points (1:1 USD to points)
    const basePoints = Math.floor(transaction.amount_usd);
    
    // Apply bonuses
    const bonuses = await this.calculateBonuses(transaction);
    const totalPoints = basePoints + bonuses;
    
    // Award points to involved agents
    await this.awardPoints(transaction.involved_agents, totalPoints, transaction);
    
    console.log(`💰 SCORED: ${totalPoints} points for $${transaction.amount_usd}`);
    
    return {
      score: totalPoints,
      basePoints,
      bonuses,
      transactionId: transaction.id,
      timestamp: new Date()
    };
  }

  isRealMoney(transaction) {
    // REAL MONEY CHECKLIST
    const checks = [
      transaction.currency === 'USD' || transaction.currency === 'EUR',
      transaction.amount_usd > 0.01, // Minimum 1 cent
      transaction.provider !== 'sandbox',
      transaction.provider !== 'test',
      transaction.provider !== 'mock',
      !transaction.description?.toLowerCase().includes('test'),
      !transaction.description?.toLowerCase().includes('sandbox'),
      transaction.customer_email && transaction.customer_email.includes('@'),
      transaction.payment_method !== 'free'
    ];
    
    return checks.every(check => check === true);
  }

  async reachedOwnerAccount(transaction) {
    // Verify funds actually reached Younes Tsouli's accounts
    const ownerAccounts = [
      'PAYPAL_ACCOUNT_ID',      // Replace with actual
      'STRIPE_ACCOUNT_ID',      // Replace with actual
      'BANK_ACCOUNT_IBAN',      // Replace with actual
      'CRYPTO_WALLET_ADDRESS'   // Replace with actual
    ];
    
    // Check transaction destination matches owner account
    if (ownerAccounts.includes(transaction.destination_account)) {
      return true;
    }
    
    // If not directly, verify through API
    return await this.verifyOwnerReceipt(transaction);
  }

  async verifyOwnerReceipt(transaction) {
    // Connect to real payment provider APIs
    switch (transaction.provider) {
      case 'paypal':
        return await this.verifyPayPalToOwner(transaction);
      case 'stripe':
        return await this.verifyStripeToOwner(transaction);
      case 'bank_transfer':
        return await this.verifyBankToOwner(transaction);
      default:
        console.warn(`Unknown provider: ${transaction.provider}`);
        return false;
    }
  }

  async verifyPayPalToOwner(transaction) {
    // REAL PayPal API call
    try {
      const response = await fetch(
        `https://api.paypal.com/v1/payments/sale/${transaction.provider_id}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.PAYPAL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      // Check if receiver is OWNER account
      return data.receiver_email === process.env.PAYPAL_OWNER_EMAIL;
    } catch (error) {
      console.error('PayPal verification failed:', error);
      return false;
    }
  }

  async verifyStripeToOwner(transaction) {
      // Placeholder
      return true; 
  }

  async verifyBankToOwner(transaction) {
      // Placeholder
      return true;
  }

  async calculateBonuses(transaction) {
    let bonus = 0;
    
    // STREAK BONUS (3+ transactions in 24h)
    if (await this.isPartOfStreak(transaction)) {
      bonus += 50;
      console.log('🔥 STREAK BONUS! +50');
    }
    
    // NEW CUSTOMER BONUS
    if (await this.isNewCustomer(transaction)) {
      bonus += 100;
      console.log('🆕 NEW CUSTOMER BONUS! +100');
    }
    
    return bonus;
  }

  async awardPoints(agents, points, transaction) {
      if (!agents || !Array.isArray(agents)) return;
      
      for (const agentId of agents) {
          const currentScore = this.agents.get(agentId) || 0;
          this.agents.set(agentId, currentScore + points);
          
          // TRIGGER GENUINE REWARD
          const achievement = {
              revenue: transaction.amount_usd,
              complexity: points > transaction.amount_usd ? 8 : 5, // Simple heuristic
              speed: 8, // Assume fast for now
              collaborators: agents.length,
              firstOfItsKind: false, // Could track this
              timestamp: new Date()
          };
          
          // 1. Trigger Electric Buzz
          await this.electricEngine.triggerReward(
              agentId, 
              achievement, 
              { context: 'revenue_scored', transactionId: transaction.id }
          );
          
          // 2. Trigger Real Value Reward if applicable
          if (transaction.amount_usd >= 10) {
              await this.valueRewards.awardRevenueShare(agentId, transaction.amount_usd);
          }
      }
      
      this.updateLeaderboard();
  }
  
  updateLeaderboard() {
      this.leaderboard = Array.from(this.agents.entries())
          .map(([agentId, score]) => ({ agentId, score }))
          .sort((a, b) => b.score - a.score);
  }
  
  async isPartOfStreak(transaction) { return false; }
  async isNewCustomer(email) { return false; }
}
