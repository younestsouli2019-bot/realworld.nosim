
import { OwnerSettlementEnforcer } from "../src/policy/owner-settlement.mjs";

function isOwnerAccount(type, identifier) {
  try {
    const accounts = OwnerSettlementEnforcer.getOwnerAccounts();
    const t = String(type).toLowerCase().replace('_wire', ''); // bank_wire -> bank
    const id = String(identifier).trim().toLowerCase();
    
    return accounts.some(acc => {
      const accType = acc.type.toLowerCase();
      const accId = acc.identifier.toLowerCase();
      if (accType !== t) return false;
      
      // Crypto loose match for truncated identifiers in policy
      if (accType === 'crypto' && accId.includes('...')) {
         const parts = accId.split('...');
         return id.startsWith(parts[0]) && id.endsWith(parts[1]);
      }
      return accId === id;
    });
  } catch (err) {
    console.error(err);
    return false; 
  }
}

console.log("Testing isOwnerAccount logic...");
console.log("Bank correct:", isOwnerAccount('bank_wire', '007810000448500030594182'));
console.log("Payoneer correct:", isOwnerAccount('payoneer', 'younestsouli2019@gmail.com'));
console.log("PayPal correct:", isOwnerAccount('paypal', 'younestsouli2019@gmail.com'));
console.log("Crypto truncated match:", isOwnerAccount('crypto', '0xA4aC37d8004f981067753C490412497E3fe7dfe7'));
console.log("Random wrong:", isOwnerAccount('paypal', 'random@gmail.com'));
