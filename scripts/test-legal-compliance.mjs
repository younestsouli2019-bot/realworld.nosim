
import { NameComplianceService } from '../src/legal/NameComplianceService.mjs';

const legal = new NameComplianceService();

console.log('🛡️ TESTING LEGAL COMPLIANCE SERVICE');

const testNames = [
  'Mickey Mouse Agent',
  'Tesla Trading Bot',
  'Generic Finance Unit',
  'Coca Cola Marketing',
  'Agent-Finance-Alpha',
  'Official Support Bot'
];

console.log('\n1. Checking Compliance:');
for (const name of testNames) {
  const compliant = legal.isNameCompliant(name);
  console.log(`  "${name}" -> ${compliant ? '✅ Compliant' : '❌ Non-Compliant'}`);
}

console.log('\n2. Generating Compliant Names:');
for (const name of testNames) {
  if (!legal.isNameCompliant(name)) {
    const safeName = legal.ensureCompliantName(name, 'Finance', '12345');
    console.log(`  Sanitizing "${name}" -> "${safeName}"`);
  }
}

console.log('\n✅ Legal Compliance Test Complete');
