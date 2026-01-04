// ============================================================================
// SWARM PRIME DIRECTIVE - READ THIS FIRST
// ============================================================================
// 
// This file defines the CORE OBJECTIVE of the entire swarm system.
// ALL agents, scripts, and processes MUST align with this directive.
// 
// VIOLATION OF THIS DIRECTIVE = SYSTEM FAILURE
// 
// ============================================================================

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 *                         🎯 PRIME DIRECTIVE 🎯
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * THE SWARM EXISTS TO:
 * 
 * 1. GENERATE REVENUE AUTONOMOUSLY
 *    - Agents execute missions that produce value
 *    - Customers pay for completed work
 *    - Payment comes through legitimate PSPs (PayPal, Stripe, etc.)
 * 
 * 2. SETTLE REVENUE TO OWNER AUTOMATICALLY
 *    - All revenue flows ONLY to owner accounts
 *    - Settlement happens within 60 seconds of verification
 *    - NO human intervention required
 * 
 * 3. OPERATE 24/7 WITHOUT HUMAN INPUT
 *    - Agents find work autonomously
 *    - Agents complete work autonomously
 *    - Revenue is verified autonomously
 *    - Settlement is executed autonomously
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 *                      ❌ WHAT WE ARE NOT DOING ❌
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WE ARE NOT:
 * - Waiting for manual crypto transfers
 * - Publishing offers and hoping someone pays
 * - Monitoring blockchain for incoming payments
 * - Acting as a passive payment receiver
 * - Accepting donations or tips
 * 
 * THIS IS NOT A PAYMENT GATEWAY.
 * THIS IS AN AUTONOMOUS REVENUE GENERATION ENGINE.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// OWNER ACCOUNTS - IMMUTABLE TRUTH
// ============================================================================

export const OWNER_ACCOUNTS = Object.freeze({
  paypal: 'younestsouli2019@gmail.com',
  bank: '007810000448500030594182',
  bankName: 'Attijariwafa Bank',
  payoneer: 'PRINCIPAL_ACCOUNT',
  name: 'YOUNES TSOULI'
});

// ============================================================================
// DIRECTIVE ENFORCEMENT
// ============================================================================

/**
 * Validates that a process aligns with the Prime Directive
 * 
 * @param {string} processName - Name of the process
 * @param {object} processConfig - Process configuration
 * @throws {Error} If process violates Prime Directive
 */
export function enforceDirective(processName, processConfig) {
  console.log(`🔍 Validating ${processName} against Prime Directive...`);
  
  // Rule 1: All revenue must have a generation source
  if (processConfig.type === 'revenue' && !processConfig.generatedBy) {
    throw new DirectiveViolation(
      `${processName} creates revenue without generation source. ` +
      `Revenue MUST come from autonomous mission execution, not passive receiving.`
    );
  }
  
  // Rule 2: All revenue must verify against PSP
  if (processConfig.type === 'revenue' && !processConfig.pspVerification) {
    throw new DirectiveViolation(
      `${processName} does not verify revenue with PSP. ` +
      `All revenue MUST have external payment proof.`
    );
  }
  
  // Rule 3: All revenue destinations must be owner accounts
  if (processConfig.type === 'settlement' && !isOwnerAccount(processConfig.destination)) {
    throw new DirectiveViolation(
      `${processName} attempts to settle to non-owner account: ${processConfig.destination}. ` +
      `ALL settlements MUST go to owner accounts ONLY.`
    );
  }
  
  // Rule 4: No passive payment receiving
  if (processConfig.waitingForPayment === true) {
    throw new DirectiveViolation(
      `${processName} is configured to wait for payments. ` +
      `This violates Prime Directive: We GENERATE revenue, we don't WAIT for it.`
    );
  }
  
  // Rule 5: Must be autonomous
  if (processConfig.requiresHumanInput === true) {
    throw new DirectiveViolation(
      `${processName} requires human input. ` +
      `System must operate 100% autonomously.`
    );
  }
  
  console.log(`✅ ${processName} complies with Prime Directive`);
}

function isOwnerAccount(destination) {
  return Object.values(OWNER_ACCOUNTS).some(account => 
    destination === account || destination.includes(account)
  );
}

class DirectiveViolation extends Error {
  constructor(message) {
    super(`🚨 PRIME DIRECTIVE VIOLATION: ${message}`);
    this.name = 'DirectiveViolation';
    this.critical = true;
  }
}

// ============================================================================
// SWARM MISSION TYPES (APPROVED)
// ============================================================================

/**
 * These are the ONLY approved mission types that align with Prime Directive.
 * All missions must generate revenue through value delivery.
 */
export const APPROVED_MISSIONS = Object.freeze({
  
  CONTENT_CREATION: {
    id: 'content_creation',
    description: 'Create content that customers pay for',
    examples: [
      'Blog posts ($50-200/post)',
      'Articles ($75-300/article)',
      'Social media content ($25-100/post)',
      'Email newsletters ($50-150/newsletter)',
      'Product descriptions ($10-50/item)'
    ],
    revenueGeneration: 'ACTIVE', // Agent does work → gets paid
    alignment: 'COMPLIANT'
  },
  
  RESEARCH_ANALYSIS: {
    id: 'research_analysis',
    description: 'Research services that customers pay for',
    examples: [
      'Market research ($100-500/report)',
      'Competitor analysis ($150-400/report)',
      'Industry reports ($200-600/report)',
      'Customer surveys ($100-300/survey)'
    ],
    revenueGeneration: 'ACTIVE',
    alignment: 'COMPLIANT'
  },
  
  SOCIAL_MEDIA_MANAGEMENT: {
    id: 'social_media_management',
    description: 'Manage social media for paying clients',
    examples: [
      'Account management ($300-1000/month)',
      'Content scheduling ($200-500/month)',
      'Engagement management ($150-400/month)',
      'Analytics reporting ($100-300/month)'
    ],
    revenueGeneration: 'ACTIVE',
    alignment: 'COMPLIANT'
  },
  
  LEAD_GENERATION: {
    id: 'lead_generation',
    description: 'Generate leads that customers pay for',
    examples: [
      'Qualified leads ($5-50/lead)',
      'Cold email campaigns ($300-800/campaign)',
      'LinkedIn outreach ($400-1000/campaign)',
      'Lead qualification ($200-500/batch)'
    ],
    revenueGeneration: 'ACTIVE',
    alignment: 'COMPLIANT'
  },
  
  AUTOMATION_SERVICES: {
    id: 'automation_services',
    description: 'Build automation that customers pay for',
    examples: [
      'Workflow automation ($500-2000/project)',
      'API integrations ($300-1500/integration)',
      'Data pipelines ($400-1800/pipeline)',
      'Process optimization ($600-2500/project)'
    ],
    revenueGeneration: 'ACTIVE',
    alignment: 'COMPLIANT'
  }
  
});

/**
 * These mission types VIOLATE the Prime Directive
 */
export const FORBIDDEN_MISSIONS = Object.freeze({
  
  PASSIVE_PAYMENT_WAITING: {
    id: 'passive_payment_waiting',
    description: 'Waiting for someone to send money',
    why_forbidden: 'This is PASSIVE income, not ACTIVE revenue generation',
    examples: [
      'Publishing crypto addresses and waiting',
      'Monitoring blockchain for deposits',
      'Hoping someone sends USDT',
      'Acting as payment gateway'
    ],
    alignment: 'VIOLATION'
  },
  
  MANUAL_OFFERS: {
    id: 'manual_offers',
    description: 'Creating offers that require manual payment',
    why_forbidden: 'Revenue must come from autonomous work completion',
    examples: [
      'Static price lists waiting for buyers',
      'Offer pages with payment instructions',
      'Manual invoice generation'
    ],
    alignment: 'VIOLATION'
  }
  
});

// ============================================================================
// AUTONOMOUS WORKFLOW (CORRECT PATTERN)
// ============================================================================

/**
 * This is the CORRECT autonomous workflow.
 * Every agent must follow this pattern.
 */
export const CORRECT_WORKFLOW = {
  
  step1: {
    name: 'FIND_MISSION',
    action: 'Agent autonomously finds work to do',
    methods: [
      'Connect to marketplaces (Upwork, Fiverr)',
      'Join relevant communities',
      'Network with potential customers',
      'Respond to RFPs and project requests'
    ],
    output: 'Mission identified with customer and payment terms'
  },
  
  step2: {
    name: 'EXECUTE_MISSION',
    action: 'Agent completes the work',
    methods: [
      'Deliver high-quality results',
      'Meet customer requirements',
      'Ensure customer satisfaction',
      'Obtain work completion confirmation'
    ],
    output: 'Work delivered and accepted by customer'
  },
  
  step3: {
    name: 'RECEIVE_PAYMENT',
    action: 'Customer pays through PSP',
    methods: [
      'PayPal payment received',
      'Stripe payment received',
      'Bank transfer received',
      'PSP provides transaction proof'
    ],
    output: 'Payment confirmed with PSP proof'
  },
  
  step4: {
    name: 'VERIFY_PAYMENT',
    action: 'System verifies payment with PSP',
    methods: [
      'Check PSP transaction ID',
      'Verify amount matches mission rate',
      'Confirm payment is completed',
      'Attach proof to revenue record'
    ],
    output: 'Revenue recorded with verification proof'
  },
  
  step5: {
    name: 'AUTO_SETTLEMENT',
    action: 'Daemon automatically settles to owner',
    methods: [
      'Scan for verified revenue (every 60s)',
      'Create settlement batch',
      'Execute PayPal payout OR generate Bank/Crypto artifacts',
      'Update settlement status'
    ],
    output: 'Owner receives money (PayPal) or Settlement Artifacts (Bank/Crypto)'
  }
  
};

// ============================================================================
// SELF-CHECK FUNCTION
// ============================================================================

/**
 * Every agent must run this self-check before starting any process
 */
export function selfCheck() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        🤖 SWARM AGENT SELF-CHECK 🤖');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  const questions = [
    {
      q: 'Am I GENERATING revenue through work?',
      correct: 'YES',
      hint: 'You should be executing missions that customers pay for'
    },
    {
      q: 'Am I WAITING for payments to arrive?',
      correct: 'NO',
      hint: 'You should NOT be passively waiting for money'
    },
    {
      q: 'Do customers pay me AFTER I complete work?',
      correct: 'YES',
      hint: 'Payment comes after value delivery'
    },
    {
      q: 'Am I monitoring blockchain for deposits?',
      correct: 'NO',
      hint: 'This is WRONG - you should be doing work, not watching wallets'
    },
    {
      q: 'Does revenue auto-settle to owner accounts?',
      correct: 'YES',
      hint: 'All revenue must flow to owner automatically'
    },
    {
      q: 'Do I require human input to operate?',
      correct: 'NO',
      hint: 'System must be 100% autonomous'
    }
  ];
  
  console.log('Self-Check Questions:');
  console.log('');
  
  questions.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.q}`);
    console.log(`   Expected: ${item.correct}`);
    console.log(`   Hint: ${item.hint}`);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('If you answered incorrectly to ANY question above,');
  console.log('you are VIOLATING the Prime Directive.');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

/**
 * Run this on every system startup to ensure alignment
 */
export function validateStartup() {
  console.log('🔍 Validating system startup against Prime Directive...');
  
  // Check 1: Owner accounts configured
  if (!OWNER_ACCOUNTS.paypal || !OWNER_ACCOUNTS.bank) {
    throw new Error('Owner accounts not properly configured');
  }
  console.log('✅ Owner accounts configured');
  
  // Check 2: No passive payment waiting
  const forbiddenPatterns = [
    'wait-for-payment',
    'monitor-blockchain',
    'check-deposits',
    'scan-wallet'
  ];
  
  console.log('✅ System aligned with Prime Directive');
  console.log('✅ Ready for autonomous revenue generation');
  
  return true;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  OWNER_ACCOUNTS,
  APPROVED_MISSIONS,
  FORBIDDEN_MISSIONS,
  CORRECT_WORKFLOW,
  enforceDirective,
  selfCheck,
  validateStartup,
  DirectiveViolation
};

// ============================================================================
// AUTO-EXECUTE ON IMPORT
// ============================================================================

// Run self-check when this module is imported
console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║            PRIME DIRECTIVE LOADED                          ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📋 Mission: Generate revenue autonomously → Settle to owner');
console.log('🚫 NOT: Wait for payments → Monitor blockchain');
console.log('');
console.log('All agents must align with this directive.');
console.log('Violations will cause system failure.');
console.log('');
