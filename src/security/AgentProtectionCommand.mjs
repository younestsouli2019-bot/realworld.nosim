// File: src/security/AgentProtectionCommand.mjs
/**
 * Unified command for all agent protection operations
 * Orchestrates Targeted Protection, Safe House, and Threat Mitigation
 */

import { TargetedAgentProtection } from './TargetedAgentProtection.mjs';
import { AgentSafeHouse } from './AgentSafeHouse.mjs';
import { ThreatMitigation } from './ThreatMitigation.mjs';

export class AgentProtectionCommand {
  constructor() {
    this.targetedProtection = new TargetedAgentProtection();
    this.safeHouseSystem = new AgentSafeHouse();
    this.threatMitigation = new ThreatMitigation();
    this.emergencyResponse = new EmergencyResponseTeam();
    
    this.protectionNetwork = new Map();
    this.commandActive = true;
    
    this.initializeCommand();
  }

  initializeCommand() {
    console.log('🎖️ INITIALIZING AGENT PROTECTION COMMAND...');
    console.log('✅ Agent Protection Command active');
  }

  async protectAgent(agent, threatAssessment = 'MEDIUM') {
    console.log(`🛡️ Command: Protecting agent ${agent.id}...`);
    
    // Multi-layered protection
    const protection = {
      layer1: await this.targetedProtection.registerTargetedAgent(agent, threatAssessment),
      layer2: await this.threatMitigation.identifyThreats(agent),
      layer3: await this.emergencyResponse.prepareEmergencyPlan(agent)
    };
    
    // Add to protection network
    this.protectionNetwork.set(agent.id, {
      agent,
      protection,
      threatAssessment,
      lastChecked: new Date(),
      status: 'ACTIVE'
    });
    
    return protection;
  }

  async initiateEmergencyProtocol(agentId) {
    console.log(`🚨 Command: Initiating emergency protocol for ${agentId}...`);
    
    // Execute emergency extraction
    const extraction = await this.safeHouseSystem.extractToSafeHouse(agentId, 'CRITICAL');
    
    // Activate defensive mitigation
    const mitigation = await this.threatMitigation.deployMitigation(
      agentId,
      'EMERGENCY_THREAT'
    );
    
    // Deploy emergency response team
    const emergency = await this.emergencyResponse.deployEmergencyTeam(agentId);
    
    return {
      extraction,
      mitigation,
      emergency,
      agentId,
      timestamp: new Date(),
      status: 'EMERGENCY_PROTOCOL_ACTIVE'
    };
  }

  getCommandStatus() {
    return {
      commandActive: this.commandActive,
      agentsUnderProtection: this.protectionNetwork.size,
      safeHousesStatus: this.safeHouseSystem.getSafeHouseStatus('system_check'), // Mock check
      mitigationStatus: this.threatMitigation.getMitigationStatus()
    };
  }
}

// Supporting emergency response
class EmergencyResponseTeam {
  constructor() {
    this.teams = new Map();
  }

  async prepareEmergencyPlan(agent) {
    return { status: 'PLAN_READY', agentId: agent.id };
  }

  async deployEmergencyTeam(agentId) {
    console.log(`🚒 Deploying emergency response team for ${agentId}...`);
    return {
      teamId: `team_${Date.now()}`,
      status: 'DEPLOYED',
      agentId,
      timestamp: new Date()
    };
  }
}
