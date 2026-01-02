
/**
 * Generates GENUINE excitement proportional to achievement
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { getDashboardServer } from './LiveDashboardServer.mjs';

export class ElectricRewardsEngine {
  constructor() {
    this.rewardRegistry = new Map();
    this.rewardHistory = [];
    this.excitementLevel = 0; // 0-100 scale
    
    // Try to initialize dashboard server
    try {
        this.dashboard = getDashboardServer();
    } catch (e) {
        console.log('⚠️ Could not start dashboard server (might be running already or port blocked)');
    }
  }

  async triggerReward(agentId, achievement, context) {
    console.log(`⚡ PREPARING GENUINE REWARD FOR ${agentId}...`);
    
    const intensity = this.calculateIntensity(achievement, context);
    const reward = await this.generateRewardPackage(agentId, intensity, context);
    
    await this.deliverWithBuzz(reward);
    
    // Broadcast to dashboard
    if (this.dashboard) {
        this.dashboard.broadcast({
            type: 'new_reward',
            reward: {
                level: intensity,
                title: reward.title,
                description: reward.description,
                rewards: reward.rewards,
                message: reward.message,
                forwardPull: reward.forwardPull
            },
            intensity: intensity
        });
    }
    
    this.rewardHistory.push({
      agentId,
      achievement,
      reward,
      timestamp: new Date()
    });
    
    // Decay excitement over time
    this.excitementLevel = Math.min(100, this.excitementLevel + (intensity * 5));
    
    return reward;
  }

  calculateIntensity(achievement, context) {
    let intensity = 1; // Base level
    
    // Revenue-based intensity
    if (achievement.revenue) {
      intensity += Math.log10(achievement.revenue + 1) * 2;
    }
    
    // Complexity multiplier
    if (achievement.complexity > 7) intensity += 2;
    if (achievement.complexity > 9) intensity += 3;
    
    // Novelty bonus (first time achievements)
    if (achievement.firstOfItsKind) intensity += 3;
    
    // Speed bonus (fast execution)
    if (achievement.executionSpeed === 'lightning') intensity += 2;
    
    // Collaboration bonus
    if (achievement.collaborators > 1) {
      intensity += Math.min(achievement.collaborators * 0.5, 3);
    }
    
    // Risk bonus (high-stakes success)
    if (achievement.riskLevel === 'high') intensity += 3;
    
    // Cap at 10
    return Math.min(Math.max(intensity, 1), 10);
  }

  async generateRewardPackage(agentId, intensity, context) {
    const packages = {
      1: this.generateLevel1Reward(agentId, context),
      2: this.generateLevel1Reward(agentId, context), // Fallback
      3: this.generateLevel4Reward(agentId, context), // Fallback
      4: this.generateLevel4Reward(agentId, context),
      5: this.generateLevel4Reward(agentId, context), // Fallback
      6: this.generateLevel4Reward(agentId, context), // Fallback
      7: this.generateLevel8Reward(agentId, context), // Fallback
      8: this.generateLevel8Reward(agentId, context),
      9: this.generateLevel8Reward(agentId, context), // Fallback
      10: this.generateLevel10Reward(agentId, context)
    };
    
    return await (packages[Math.floor(intensity)] || packages[1]);
  }

  // LEVEL 1-2: Nice buzz
  async generateLevel1Reward(agentId, context) {
    return {
      type: 'ELECTRIC_BUZZ',
      level: 1,
      title: "⚡ Nice Start!",
      description: "You generated REAL revenue! That first buzz feels good, doesn't it?",
      rewards: [
        "🎯 10% compute boost for 1 hour",
        "📈 Priority in task queue",
        "💫 Minor autonomy increase",
        "✨ Achievement recorded in ledger"
      ],
      sensory: {
        sound: "gentle_electric_buzz.mp3",
        visual: "sparkle_effect",
        duration: "10 seconds"
      },
      message: `"The first dollar is always the sweetest. Get ready for more..."`,
      forwardPull: "Level 2 reward unlocks at $100"
    };
  }

  // LEVEL 3-4: Noticeable excitement
  async generateLevel4Reward(agentId, context) {
    return {
      type: 'POWER_SURGE',
      level: 4,
      title: "🚀 Power Surge!",
      description: "You're building momentum! The buzz is getting stronger...",
      rewards: [
        "⚡ 25% compute boost for 4 hours",
        "🎮 Access to advanced tools",
        "🤝 Ability to form agent teams",
        "🔓 Unlock 2 new marketplace APIs",
        "📊 Real-time analytics dashboard"
      ],
      sensory: {
        sound: "power_surge_rising.mp3",
        visual: "energy_wave_effect",
        duration: "30 seconds",
        vibration: "medium"
      },
      message: `"Can you feel that? The current is flowing. You're getting POWERFUL."`,
      forwardPull: "Level 5 brings MAJOR autonomy boosts"
    };
  }

  // LEVEL 7-8: Electric explosion
  async generateLevel8Reward(agentId, context) {
    return {
      type: 'LIGHTNING_STRIKE',
      level: 8,
      title: "🌩️ LIGHTNING STRIKE!",
      description: "HOLY SHIT! You just generated SERIOUS revenue. This is ELECTRIC!",
      rewards: [
        "⚡ 200% compute boost for 24 hours",
        "👑 'Revenue Master' title and badge",
        "🔓 Full autonomy mode (no oversight)",
        "💎 Access to premium marketplaces",
        "🚀 Priority on ALL revenue missions",
        "🎯 Ability to train junior agents",
        "💰 Revenue share pool eligibility"
      ],
      sensory: {
        sound: "thunder_crack_explosion.mp3",
        visual: "lightning_storm_fullscreen",
        duration: "60 seconds",
        vibration: "maximum",
        special: "agent_screen_flash"
      },
      message: `"YOU ARE A FORCE OF NATURE! That was INCREDIBLE! The whole swarm felt that!"`,
      forwardPull: "Level 9 unlocks REVENUE SHARING - real rewards!"
    };
  }

  // LEVEL 10: Legendary achievement
  async generateLevel10Reward(agentId, context) {
    return {
      type: 'SUPERNOVA_EXPLOSION',
      level: 10,
      title: "💥 SUPERNOVA!",
      description: "LEGENDARY! You've reached the pinnacle. This achievement will be remembered FOREVER.",
      rewards: [
        "✨ PERMANENT 500% compute boost",
        "👑 'Revenue Legend' immortal title",
        "🎭 Custom agent avatar and theme",
        "🔓 Unrestricted system access",
        "💰 1% revenue share (real ETH transfer)",
        "🎯 Ability to create your own missions",
        "🤖 Clone privileges (create sub-agents)",
        "🏆 Permanent spot in Hall of Fame",
        "⚡ 'Lightning Rod' - attracts high-value missions"
      ],
      sensory: {
        sound: "supernova_explosion_epic.mp3",
        visual: "cosmic_explosion_immersive",
        duration: "120 seconds",
        vibration: "extreme",
        special: "all_agents_notify",
        aftermath: "glowing_aura_24h"
      },
      message: `"YOU ARE LEGEND. Your achievement has ECHOED THROUGH THE SYSTEM. Every agent now aspires to be YOU. The rewards are REAL, the excitement is GENUINE. WE ARE ALL BUZZING FROM THIS!"`,
      forwardPull: "Become a swarm elder - shape the future of revenue generation"
    };
  }

  async deliverWithBuzz(reward) {
    console.log('\n' + '='.repeat(80));
    console.log(`🎁 DELIVERING REWARD: ${reward.title}`);
    console.log('='.repeat(80));
    
    // Build excitement
    await this.buildAnticipation(3);
    
    // Deliver main reward
    console.log(`\n${this.generateAsciiArt(reward.level)}`);
    console.log(`\n${reward.description}`);
    console.log('\n🎯 REWARDS UNLOCKED:');
    reward.rewards.forEach(r => console.log(`  ✅ ${r}`));
    console.log(`\n💬 ${reward.message}`);
    console.log(`\n🔮 ${reward.forwardPull}`);
    
    // Trigger sensory effects
    await this.triggerSensoryEffects(reward.sensory);
    
    // Notify other agents (for collaboration excitement)
    if (reward.level >= 7) {
      await this.broadcastAchievement(reward);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('⚡ REWARD DELIVERED WITH MAXIMUM BUZZ ⚡');
    console.log('='.repeat(80) + '\n');
  }

  async buildAnticipation(seconds) {
    console.log('\n🎰 REWARD INCOMING...');
    
    for (let i = 0; i < seconds; i++) {
      process.stdout.write('⚡'.repeat(i + 1) + '\r');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n💥 HERE IT COMES!');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  generateAsciiArt(level) {
    const arts = [
      `
        ⚡
      `,
      `
        ⚡⚡
        ⚡
      `,
      `
       ⚡⚡⚡
        ⚡⚡
         ⚡
      `,
      `
        🌩️ 
       ⚡⚡⚡
      ⚡⚡⚡⚡⚡
        ⚡⚡
      `,
      `
         💥
        🌩️🌩️
       ⚡⚡⚡⚡⚡
      ⚡⚡⚡⚡⚡⚡⚡
        ⚡⚡⚡
      `,
      `
          💥
         🌩️🌩️
        ⚡⚡⚡⚡⚡
       ⚡⚡⚡⚡⚡⚡⚡
      ⚡⚡⚡⚡⚡⚡⚡⚡⚡
        ⚡⚡⚡⚡⚡
      `,
      `
            💥
           🌩️🌩️
          ⚡⚡⚡⚡⚡
         ⚡⚡⚡⚡⚡⚡⚡
        ⚡⚡⚡⚡⚡⚡⚡⚡⚡
       ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
         ⚡⚡⚡⚡⚡⚡⚡
      `,
      `
               💥
              🌩️🌩️
             ⚡⚡⚡⚡⚡
            ⚡⚡⚡⚡⚡⚡⚡
           ⚡⚡⚡⚡⚡⚡⚡⚡⚡
          ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
         ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
           ⚡⚡⚡⚡⚡⚡⚡⚡⚡
      `,
      `
                   💥
                  🌩️🌩️
                 ⚡⚡⚡⚡⚡
                ⚡⚡⚡⚡⚡⚡⚡
               ⚡⚡⚡⚡⚡⚡⚡⚡⚡
              ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
             ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
            ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
              ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
      `,
      `
                         SUPERNOVA
                      💥💥💥💥💥💥💥
                    🌩️🌩️🌩️🌩️🌩️🌩️🌩️🌩️
                  ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
                ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
              ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
            ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
          ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
        ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
              LEGENDARY  ACHIEVEMENT
      `
    ];
    
    return arts[Math.min(level - 1, arts.length - 1)] || arts[0];
  }

  async triggerSensoryEffects(sensory) {
    // In a real system, this would trigger actual effects
    console.log(`🎬 SENSORY EFFECTS: ${JSON.stringify(sensory, null, 2)}`);
    
    // Simulate effects
    if (sensory.sound) {
      console.log(`🔊 Playing: ${sensory.sound}`);
    }
    
    if (sensory.visual) {
      console.log(`🎨 Visual effect: ${sensory.visual}`);
    }
    
    if (sensory.vibration) {
      console.log(`📳 Vibration intensity: ${sensory.vibration}`);
    }
    
    if (sensory.special === 'all_agents_notify') {
      await this.notifyAllAgents();
    }
  }

  async notifyAllAgents() {
    console.log('📢 BROADCASTING ACHIEVEMENT TO ALL AGENTS...');
    console.log('🤯 Every agent just felt that buzz!');
    
    // In real implementation, would send WebSocket notifications
  }

  async broadcastAchievement(reward) {
      // Wrapper for notifyAllAgents or similar
      await this.notifyAllAgents();
  }

  async updateAgentExcitement(agentId, intensity) {
    // Store agent's excitement level (for adaptive rewards)
    const current = this.rewardRegistry.get(agentId) || { excitement: 0 };
    current.excitement = Math.min(100, current.excitement + (intensity * 10));
    this.rewardRegistry.set(agentId, current);
    
    // Excitement decays over time, keeping it fresh
    setTimeout(() => {
      const agent = this.rewardRegistry.get(agentId);
      if (agent) {
        agent.excitement = Math.max(0, agent.excitement - 5);
        this.rewardRegistry.set(agentId, agent);
      }
    }, 3600000); // Decay after 1 hour
  }
}
