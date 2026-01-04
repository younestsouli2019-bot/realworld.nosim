import { UpgradeCommands, AutonomousAgentUpgrader, AgentDeploymentManager } from '../src/agents/autonomous-upgrader.mjs';

// Example 1: Quick analysis
async function quickAnalysis() {
  console.log('\n--- Running Example 1: Quick Analysis ---');
  try {
    const analysis = await UpgradeCommands.analyze();
    console.log('📊 Agent Analysis Result:', JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('Error in quickAnalysis:', error);
  }
}

// Example 2: Deploy specific upgrades
async function targetedUpgrade(agentIds) {
  console.log('\n--- Running Example 2: Targeted Upgrade ---');
  const upgrader = new AutonomousAgentUpgrader();
  
  try {
    // Get specific agents
    const allAgents = await upgrader.fetchAgentEntities();
    const targetAgents = allAgents.filter(agent => agentIds.includes(agent.id));
    
    if (targetAgents.length === 0) {
      console.log('No matching agents found for IDs:', agentIds);
      // Fallback: use all agents if none match (for demo purposes)
      if (allAgents.length > 0) {
         console.log('Falling back to analyzing all agents...');
         const analysis = await upgrader.analyzeAgentCapabilities(allAgents);
         const upgradePlan = await upgrader.generateUpgradePlan(analysis);
         const results = await upgrader.executeUpgrades(upgradePlan);
         return results;
      }
      return null;
    }

    // Create custom upgrade plan
    const analysis = await upgrader.analyzeAgentCapabilities(targetAgents);
    const upgradePlan = await upgrader.generateUpgradePlan(analysis);

    // Execute upgrades
    const results = await upgrader.executeUpgrades(upgradePlan);
    console.log('Targeted Upgrade Results:', JSON.stringify(results, null, 2));
    return results;
  } catch (error) {
    console.error('Error in targetedUpgrade:', error);
  }
}

// Example 3: Continuous monitoring (Simulated)
async function continuousMonitoring() {
  console.log('\n--- Running Example 3: Continuous Monitoring (One-Shot Simulation) ---');
  const manager = new AgentDeploymentManager();
  
  try {
    // Run once for demonstration
    const status = await manager.validateSystemReadiness();
    if (status.failed > 0) {
      console.warn('⚠️ System readiness issues detected:', status);
      // Trigger auto-remediation (simulated)
    } else {
      console.log('✅ System is ready for continuous monitoring.');
    }
  } catch (error) {
    console.error('Error in continuousMonitoring:', error);
  }
}

async function main() {
  console.log('🚀 STARTING AGENT UPGRADE TEST SUITE');
  
  await quickAnalysis();
  
  // Use dummy ID for targeted upgrade test, logic will handle fallback if needed
  await targetedUpgrade(['dummy-agent-id-1', 'dummy-agent-id-2']);
  
  await continuousMonitoring();
  
  console.log('\n✅ TEST SUITE COMPLETE');
}

main().catch(console.error);
