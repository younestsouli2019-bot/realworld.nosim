#!/usr/bin/env node
// scripts/validate-financial-env.mjs
// Universal validator for financial environment settings

// import dotenv from 'dotenv';
// dotenv.config();

console.log('================================================================');
console.log('💰 FINANCIAL ENVIRONMENT VALIDATOR');
console.log('================================================================');

const REQUIRED_VARS = [
  { key: 'FINANCIAL_MODE', expected: 'LIVE', critical: true },
  { key: 'ENABLE_REAL_MONEY_MOVEMENT', expected: 'true', critical: true },
  { key: 'DAILY_TRANSACTION_LIMIT', type: 'number', critical: true },
  { key: 'MAX_SINGLE_TRANSACTION', type: 'number', critical: true }
];

const RAIL_VARS = {
  PAYPAL: [
    { key: 'PAYPAL_MODE', expected: 'live' },
    { key: 'PAYPAL_CLIENT_ID' },
    { key: 'PAYPAL_SECRET' }
  ],
  PAYONEER: [
    { key: 'PAYONEER_MODE', expected: 'live' },
    { key: 'PAYONEER_PROGRAM_ID' },
    { key: 'PAYONEER_USER_ID' }
  ],
  CRYPTO: [
    { key: 'CRYPTO_MODE', expected: 'mainnet' },
    { key: 'CRYPTO_NETWORK', expected: 'BSC' },
    { key: 'TRUST_WALLET_ADDRESS' }
  ],
  BANK: [
    { key: 'BANK_MODE', expected: 'live' },
    { key: 'BANK_INTEGRATION_ENABLED', expected: 'true' }
  ]
};

let hasErrors = false;

// 1. Validate Core Settings
console.log('\n[1] CORE FINANCIAL SETTINGS');
REQUIRED_VARS.forEach(check => {
  const val = process.env[check.key];
  
  if (!val) {
    console.log(`❌ ${check.key} is MISSING`);
    if (check.critical) hasErrors = true;
    return;
  }

  if (check.expected && val !== check.expected) {
    console.log(`❌ ${check.key}: Expected '${check.expected}', got '${val}'`);
    if (check.critical) hasErrors = true;
    return;
  }

  if (check.type === 'number' && isNaN(parseFloat(val))) {
    console.log(`❌ ${check.key}: Expected number, got '${val}'`);
    if (check.critical) hasErrors = true;
    return;
  }

  console.log(`✅ ${check.key}: ${val}`);
});

// 2. Validate Payment Rails
console.log('\n[2] PAYMENT RAIL CONFIGURATIONS');
Object.entries(RAIL_VARS).forEach(([rail, checks]) => {
  console.log(`\n--- ${rail} ---`);
  let railValid = true;
  
  checks.forEach(check => {
    const val = process.env[check.key];
    if (!val) {
      console.log(`   ⚠️  ${check.key} is MISSING`);
      railValid = false;
      return;
    }
    if (check.expected && val !== check.expected) {
      console.log(`   ⚠️  ${check.key}: Expected '${check.expected}', got '${val}'`);
      railValid = false;
      return;
    }
    console.log(`   ✅ ${check.key}: ${val.substring(0, 10)}${val.length > 10 ? '...' : ''}`);
  });

  if (railValid) {
    console.log(`   >> ${rail} RAIL: READY FOR LIVE OPS`);
  } else {
    console.log(`   >> ${rail} RAIL: INCOMPLETE (Simulation Mode Only)`);
  }
});

console.log('\n================================================================');
if (hasErrors) {
  console.log('❌ VALIDATION FAILED: CRITICAL SETTINGS MISSING');
  console.log('   The swarm cannot execute real financial transactions safely.');
  process.exit(1);
} else {
  console.log('✅ VALIDATION PASSED: ENVIRONMENT READY FOR LIVE FINANCIAL OPS');
  process.exit(0);
}
