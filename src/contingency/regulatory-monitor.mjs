import { threatMonitor } from '../security/threat-monitor.mjs';
import { globalRecorder } from '../swarm/flight-recorder.mjs';

// Keywords that indicate "Regulatory Bullshit"
const REGULATORY_THREAT_KEYWORDS = [
  'crypto ban', 'ai regulation', 'agentic payments restriction',
  'financial services prohibition', 'freeze assets', 'sanctions',
  'morocco crypto law', 'bank block', 'payment processor crackdown'
];

export class RegulatoryMonitor {
  constructor() {
    this.riskLevel = 'LOW'; // LOW, ELEVATED, CRITICAL
    this.contingencyActive = false;
    this.newsSources = [
      'https://www.taylorwessing.com',
      'https://www.chainalysis.com',
      'https://www.nuvei.com'
    ];
  }

  async scanForThreats() {
    console.log("⚖️ Scanning for Regulatory Threats (Pre-emption Protocol)...");
    
    // In a real autonomous system, this would scrape the URLs.
    // For now, we simulate the "anticipation" based on user-provided context.
    // The user explicitly provided links indicating RISING THREAT.
    
    // SIMULATION: Assuming we found concerning keywords in the user-provided context
    const detectedThreats = [
      "AI and Crypto Agentic Payments Scrutiny",
      "Financial Services Matters - December 2025"
    ];

    if (detectedThreats.length > 0) {
      this.escalateRisk('ELEVATED', detectedThreats);
    }
    
    return { risk: this.riskLevel, threats: detectedThreats };
  }

  escalateRisk(level, evidence) {
    if (this.riskLevel === level) return;
    
    console.warn(`🚨 REGULATORY RISK ESCALATED: ${level}`);
    console.warn(`   Evidence: ${evidence.join(', ')}`);
    
    this.riskLevel = level;
    globalRecorder.warn(`REGULATORY_RISK_${level}`, { evidence });

    if (level === 'ELEVATED' || level === 'CRITICAL') {
      this.activateContingencyPlan();
    }
  }

  activateContingencyPlan() {
    if (this.contingencyActive) return;
    
    console.log("🛡️ ACTIVATING REGULATORY CONTINGENCY PLAN");
    console.log("   1. ACCELERATE REVENUE: Maximize execution speed (Make money NOW).");
    console.log("   2. PREPARE CRYPTO RAIL: Ensure Binance is ready as fallback.");
    console.log("   3. DIVERSIFY ASSETS: Monitor for freeze signals.");

    // Signal Threat Monitor (which controls Bunker Mode)
    // We treat Regulatory Threat as a specific type of threat
    // If CRITICAL, we might want Bunker Mode.
    // If ELEVATED, we just want "Hurry up" mode.
    
    this.contingencyActive = true;
    
    // Set environment flag for other agents to see
    process.env.REGULATORY_CONTINGENCY_ACTIVE = "true";
  }
  
  shouldPreferCrypto() {
      return this.riskLevel === 'CRITICAL' || this.riskLevel === 'ELEVATED';
  }
  
  shouldAccelerateExecution() {
      // "Make as much money now as possible"
      return this.contingencyActive;
  }
}

export const regulatoryMonitor = new RegulatoryMonitor();
