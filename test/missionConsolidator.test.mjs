import { IntelligentMissionConsolidator } from '../src/swarm/mission-consolidator.mjs';
import assert from 'assert';

const mockMissions = [
    {
        id: "mission_1",
        title: "Setup PayPal Payouts for US",
        type: "financial",
        priority: "high",
        status: "in_progress",
        assigned_agent_ids: '["agent_dev_1", "agent_finance_1"]',
        mission_parameters: JSON.stringify({
            objective: "Configure PayPal API for US market payouts",
            region: "US",
            currency: "USD"
        }),
        progress_data: JSON.stringify({ percentage: 50 }),
        estimated_duration_hours: "8"
    },
    {
        id: "mission_2",
        title: "Configure US PayPal API Integration",
        type: "financial",
        priority: "high",
        status: "pending",
        assigned_agent_ids: '["agent_dev_1", "agent_finance_1"]',
        mission_parameters: JSON.stringify({
            description: "Integrate PayPal API for US withdrawals",
            region: "US",
            currency: "USD"
        }),
        progress_data: JSON.stringify({ percentage: 0 }),
        estimated_duration_hours: "6"
    },
    {
        id: "mission_3",
        title: "Deploy Server Monitoring",
        type: "operations",
        priority: "medium",
        status: "active",
        assigned_agent_ids: '["agent_ops_1"]',
        mission_parameters: JSON.stringify({
            objective: "Setup system monitoring daemon"
        }),
        estimated_duration_hours: "4"
    }
];

console.log("Running Mission Consolidator Tests...");

const consolidator = new IntelligentMissionConsolidator(mockMissions);
const clusters = consolidator.detectClusters();

console.log(`Detected ${clusters.length} clusters.`);

// Assertions
try {
    assert.strictEqual(clusters.length, 1, "Should detect 1 cluster");
    const cluster = clusters[0];
    
    assert.ok(cluster.missionIds.includes("mission_1"), "Cluster should include mission_1");
    assert.ok(cluster.missionIds.includes("mission_2"), "Cluster should include mission_2");
    assert.ok(!cluster.missionIds.includes("mission_3"), "Cluster should NOT include mission_3");
    
    console.log("Cluster detection passed.");
    
    const consolidated = consolidator.generateConsolidatedMission(cluster);
    console.log("Consolidated Mission Generated:", consolidated.title);
    
    assert.ok(consolidated.title.includes("CONSOLIDATED"), "Title should indicate consolidation");
    assert.strictEqual(consolidated.type, "financial", "Type should be preserved");
    
    const agents = JSON.parse(consolidated.assigned_agent_ids);
    assert.ok(agents.includes("agent_finance_1"), "Agents should be merged");
    assert.ok(agents.includes("agent_dev_1"), "Agents should be merged");
    // assert.ok(agents.includes("agent_qa_1"), "Agents should be merged");
    
    console.log("Consolidated mission verification passed.");
    
    const report = consolidator.generateConsolidationReport();
    console.log("Efficiency Gain:", report.potential_resource_savings.estimated_efficiency_gain);
    
    assert.ok(report.potential_resource_savings.total_hours_saved > 0, "Should calculate savings");
    
    console.log("All tests passed!");
} catch (e) {
    console.error("Test Failed:", e);
    process.exit(1);
}
