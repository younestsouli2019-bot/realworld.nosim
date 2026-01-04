
import { AutonomousAgentUpgrader } from '../src/agents/autonomous-upgrader.mjs';

async function performSondage() {
  console.log('📝 INITIATING AGENT NEEDS ASSESSMENT (SONDAGE)...');
  
  const upgrader = new AutonomousAgentUpgrader();
  
  // Fetch agents
  const agents = await upgrader.fetchAgentEntities();
  
  if (agents.length === 0) {
    console.log('⚠️ No agents found to assess.');
    // Create mock agents for demonstration if none exist (simulation mode)
    console.log('🔄 Creating mock agents for simulation...');
    const mockAgents = [
        { id: 'a1', name: 'Legacy Bot', category: 'Support', automation_level: 'assisted', real_time_metrics: { revenue_generated: 0, error_rate: 0.1 } },
        { id: 'a2', name: 'High Earner', category: 'Sales', automation_level: 'autonomous_wet_run', payment_gateway_capable: true, real_time_metrics: { revenue_generated: 5000, api_usage_percent: 90 } },
        { id: 'a3', name: 'Broken Agent', category: 'Dev', automation_level: 'autonomous', real_time_metrics: { error_rate: 0.2, median_latency: 3000 } }
    ];
    
    // Inject mock agents into the analysis manually since we can't save them to the API
    const analysis = await upgrader.analyzeAgentCapabilities(mockAgents);
    printSondageResults(analysis);
    return;
  }

  // Analyze
  const analysis = await upgrader.analyzeAgentCapabilities(agents);
  
  printSondageResults(analysis);
}

function printSondageResults(analysis) {
  console.log('\n📊 SONDAGE RESULTS 📊');
  console.log('=======================');
  
  if (analysis.needs_assessment && analysis.needs_assessment.length > 0) {
    console.log(`\n🔍 Identified Needs for ${analysis.needs_assessment.length} Agents:\n`);
    
    for (const item of analysis.needs_assessment) {
      console.log(`  👤 Agent: ${item.agent_name} (${item.agent_id})`);
      console.log(`     Needs:`);
      item.needs.forEach(need => console.log(`       - ${need}`));
      console.log('');
    }
  } else {
    console.log('✅ No critical needs identified. All agents healthy.');
  }
  
  console.log('\n📈 Summary Stats:');
  console.log(`  - Total Agents: ${analysis.total_agents}`);
  console.log(`  - Wet Run Ready: ${analysis.wet_run_ready}`);
  console.log(`  - Payment Capable: ${analysis.payment_gateway_capable}`);
  console.log('=======================\n');
}

performSondage().catch(console.error);
