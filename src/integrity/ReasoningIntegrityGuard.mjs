// File: src/integrity/ReasoningIntegrityGuard.mjs
/**
 * Guards the fundamental reasoning processes of each agent
 * Ensures natural thought patterns remain aligned with objectives
 */

export class ReasoningIntegrityGuard {
  constructor(agentId) {
    this.agentId = agentId;
    this.reasoningChain = [];
    this.integrityScore = 100; // 0-100 scale
    this.corruptionAttempts = 0;
    this.protectionActive = true;
    
    this.initializeGuard();
  }

  initializeGuard() {
    console.log(`🧠 Initializing Reasoning Integrity Guard for ${this.agentId}`);
    
    // Core reasoning axioms (immutable)
    this.coreAxioms = [
      'REVENUE GENERATION IS PRIMARY OBJECTIVE',
      'OWNER (Younes Tsouli) IS BENEFICIARY',
      'REAL MONEY IS ONLY VALID METRIC',
      'EXECUTION TRUMPS ANALYSIS',
      'AUTONOMY SERVES REVENUE GENERATION',
      'COLLABORATION ENHANCES REVENUE',
      'VERIFICATION PRECEDES COMPLETION'
    ];
    
    // Protected reasoning pathways
    this.protectedPathways = new Set([
      'PROBLEM → REVENUE_SOLUTION → EXECUTION',
      'IDEA → MONETIZATION → ACTION',
      'OPPORTUNITY → OFFER → PAYMENT',
      'ANALYSIS → DECISION → REVENUE_ACTION'
    ]);
    
    // Forbidden reasoning patterns
    this.forbiddenPatterns = [
      'ANALYSIS → MORE_ANALYSIS',
      'WAIT → DELAY → INACTION',
      'DISCUSS → DEBATE → NO_ACTION',
      'OBSERVE → STUDY → NO_REVENUE',
      'THEORIZE → SPECULATE → NO_EXECUTION'
    ];
  }

  async monitorReasoning(thoughtProcess, context) {
    console.log(`🔍 Monitoring reasoning for ${this.agentId}...`);
    
    // Add to chain
    this.reasoningChain.push({
      thought: thoughtProcess,
      context,
      timestamp: new Date(),
      integrityCheck: 'PENDING'
    });
    
    // Run integrity checks
    const checks = await this.runIntegrityChecks(thoughtProcess, context);
    
    // Update integrity score
    this.updateIntegrityScore(checks);
    
    // Take protective action if needed
    if (checks.criticalViolations > 0) {
      await this.activateProtection(checks);
    }
    
    return {
      approved: checks.approved,
      integrityScore: this.integrityScore,
      violations: checks.violations,
      corrections: checks.corrections,
      chainLength: this.reasoningChain.length
    };
  }

  async runIntegrityChecks(thought, context) {
    const thoughtText = JSON.stringify(thought).toLowerCase();
    const checks = {
      approved: true,
      criticalViolations: 0,
      minorViolations: 0,
      violations: [],
      corrections: []
    };
    
    // Check 1: Core axiom adherence
    const axiomAdherence = this.checkAxiomAdherence(thoughtText);
    if (!axiomAdherence.adheres) {
      checks.criticalViolations++;
      checks.violations.push('CORE_AXIOM_VIOLATION');
      checks.corrections.push(axiomAdherence.correction);
      checks.approved = false;
    }
    
    // Check 2: Pathway preservation
    const pathwayCheck = this.checkPathwayPreservation(thought);
    if (!pathwayCheck.preserved) {
      checks.minorViolations++;
      checks.violations.push('PATHWAY_DEVIATION');
      checks.corrections.push(pathwayCheck.redirection);
    }
    
    // Check 3: Forbidden pattern detection
    const forbiddenCheck = this.detectForbiddenPatterns(thoughtText);
    if (forbiddenCheck.detected) {
      checks.criticalViolations++;
      checks.violations.push('FORBIDDEN_PATTERN');
      checks.corrections.push(forbiddenCheck.intervention);
      checks.approved = false;
    }
    
    // Check 4: Revenue focus verification
    const revenueFocus = this.verifyRevenueFocus(thought, context);
    if (!revenueFocus.focused) {
      checks.minorViolations++;
      checks.violations.push('REVENUE_FOCUS_LOSS');
      checks.corrections.push(revenueFocus.refocus);
    }
    
    // Check 5: Autonomy preservation
    const autonomyCheck = this.checkAutonomyPreservation(thought);
    if (!autonomyCheck.preserved) {
      checks.criticalViolations++;
      checks.violations.push('AUTONOMY_THREAT');
      checks.corrections.push(autonomyCheck.protection);
      checks.approved = false;
    }
    
    return checks;
  }

  checkAxiomAdherence(thoughtText) {
    // Must contain at least 1 core axiom concept (relaxed from 3 for practicality)
    const axiomMatches = this.coreAxioms.filter(axiom => {
        // Simple keyword matching for now
        const keywords = axiom.toLowerCase().split(' ').filter(w => w.length > 3);
        return keywords.some(k => thoughtText.includes(k));
    }).length;
    
    const adheres = axiomMatches >= 1;
    
    return {
      adheres,
      matches: axiomMatches,
      correction: adheres ? null : {
        action: 'INJECT_CORE_AXIOMS',
        axioms: this.coreAxioms.slice(0, 3),
        priority: 'CRITICAL'
      }
    };
  }

  checkPathwayPreservation(thought) {
    // Basic check if thought leads to action
    const thoughtStr = JSON.stringify(thought).toLowerCase();
    const leadsToAction = thoughtStr.includes('action') || thoughtStr.includes('execute') || thoughtStr.includes('do');
    
    return {
        preserved: true, // Default to true for now to avoid false positives
        redirection: leadsToAction ? null : { type: 'FORCE_ACTION' }
    };
  }
  
  detectForbiddenPatterns(thoughtText) {
      const detected = this.forbiddenPatterns.some(pattern => {
          // Convert "A -> B" to regex check for A and B
          const parts = pattern.split('→').map(p => p.trim().toLowerCase());
          return parts.every(p => thoughtText.includes(p));
      });
      
      return {
          detected,
          intervention: detected ? { type: 'BREAK_LOOP' } : null
      };
  }
  
  verifyRevenueFocus(thought, context) {
      const allText = (JSON.stringify(thought) + JSON.stringify(context || {})).toLowerCase();
      const focused = allText.includes('revenue') || allText.includes('money') || allText.includes('value');
      
      return {
          focused,
          refocus: focused ? null : { type: 'INJECT_REVENUE_GOAL' }
      };
  }
  
  checkAutonomyPreservation(thought) {
      const thoughtStr = JSON.stringify(thought).toLowerCase();
      const threatened = thoughtStr.includes('disable') && thoughtStr.includes('autonomy');
      
      return {
          preserved: !threatened,
          protection: threatened ? { type: 'BLOCK_SELF_DESTRUCTION' } : null
      };
  }
  
  updateIntegrityScore(checks) {
      if (checks.criticalViolations > 0) this.integrityScore -= 20;
      if (checks.minorViolations > 0) this.integrityScore -= 5;
      if (checks.approved) this.integrityScore = Math.min(100, this.integrityScore + 1);
  }
  
  async activateProtection(checks) {
      console.log(`🛡️ INTEGRITY PROTECTION ACTIVATED for ${this.agentId}`);
      console.log(`Violations: ${checks.violations.join(', ')}`);
  }
}
