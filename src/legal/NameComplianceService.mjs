
import crypto from 'crypto';

// ============================================================================
// LEGAL & COMPLIANCE: NAME SAFETY
// ============================================================================
// Purpose: Prevent trademark infringement and ensure agent names are generic/safe.

const TRADEMARK_BLOCKLIST = [
  // Tech Giants
  'google', 'apple', 'microsoft', 'amazon', 'facebook', 'meta', 'netflix', 'tesla', 'spacex', 'twitter', 'x.com', 'openai', 'chatgpt',
  'ibm', 'oracle', 'salesforce', 'adobe', 'intel', 'nvidia', 'amd', 'samsung', 'sony', 'lg', 'hp', 'dell',
  
  // Entertainment
  'disney', 'marvel', 'dc', 'star wars', 'harry potter', 'lord of the rings', 'pokemon', 'nintendo', 'playstation', 'xbox',
  'mickey', 'minnie', 'donald duck', 'goofy', 'superman', 'batman', 'spiderman', 'iron man', 'avengers',
  
  // Consumer Brands
  'coca cola', 'pepsi', 'nike', 'adidas', 'mcdonalds', 'burger king', 'starbucks', 'kfc', 'subway',
  'gucci', 'prada', 'louis vuitton', 'chanel', 'hermes', 'rolex', 'ferrari', 'lamborghini', 'porsche', 'mercedes', 'bmw',
  
  // Financial
  'visa', 'mastercard', 'amex', 'paypal', 'stripe', 'square', 'coinbase', 'binance', 'ftx', 'goldman sachs', 'jpmorgan',
  
  // Government/Official
  'nasa', 'fbi', 'cia', 'nsa', 'irs', 'who', 'un', 'nato', 'eu', 'usa', 'police', 'army', 'navy', 'air force'
];

const SAFE_PREFIXES = [
  'Agent', 'Unit', 'Node', 'Worker', 'Operator', 'System', 'Protocol', 'Vector', 'Nexus', 'Core'
];

const SAFE_SUFFIXES = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'Prime', 'Ultra', 'Max', 'Pro', 'Lite', 'Zero', 'One', 'X', 'Y', 'Z'
];

export class NameComplianceService {
  constructor() {
    this.blocklist = TRADEMARK_BLOCKLIST;
  }

  /**
   * Checks if a name is legally safe (no trademark violations).
   * @param {string} name 
   * @returns {boolean}
   */
  isNameCompliant(name) {
    if (!name || typeof name !== 'string') return false;
    const lowerName = name.toLowerCase();
    
    // Check strict blocklist
    for (const blocked of this.blocklist) {
      if (blocked.length <= 4) {
        // Use word boundary for short words to avoid false positives (e.g., 'un' in 'Unit')
        const regex = new RegExp(`\\b${blocked}\\b`, 'i');
        if (regex.test(lowerName)) {
          return false;
        }
      } else {
        // Substring match for longer trademarks
        if (lowerName.includes(blocked)) {
          return false;
        }
      }
    }
    
    // Check for "impersonation" patterns (e.g. "Official Support", "Admin")
    if (lowerName.includes('official') || lowerName.includes('admin') || lowerName.includes('support') || lowerName.includes('staff')) {
      return false;
    }
    
    return true;
  }

  /**
   * Generates a safe, non-infringing name for an agent.
   * @param {string} category - Agent category (e.g., 'finance', 'creative')
   * @param {string} id - Agent ID (optional, for deterministic naming)
   * @returns {string}
   */
  generateCompliantName(category = 'General', id = null) {
    const prefix = SAFE_PREFIXES[Math.floor(Math.random() * SAFE_PREFIXES.length)];
    const suffix = SAFE_SUFFIXES[Math.floor(Math.random() * SAFE_SUFFIXES.length)];
    
    // If ID is provided, use it to generate a short hash suffix for uniqueness
    let uniquePart = '';
    if (id) {
      const hash = crypto.createHash('sha256').update(id).digest('hex').substring(0, 4).toUpperCase();
      uniquePart = `-${hash}`;
    } else {
      const randomNum = Math.floor(Math.random() * 1000);
      uniquePart = `-${randomNum}`;
    }
    
    // Capitalize category
    const catFormatted = category.charAt(0).toUpperCase() + category.slice(1);
    
    return `${prefix}-${catFormatted}-${suffix}${uniquePart}`;
  }

  /**
   * Sanitizes a name if it violates compliance, otherwise returns it.
   * @param {string} name 
   * @param {string} category 
   * @param {string} id 
   * @returns {string}
   */
  ensureCompliantName(name, category, id) {
    if (this.isNameCompliant(name)) {
      return name;
    }
    
    console.warn(`⚠️ Name "${name}" flagged as non-compliant. Generating safe replacement.`);
    return this.generateCompliantName(category, id);
  }
}
