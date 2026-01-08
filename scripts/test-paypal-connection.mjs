#!/usr/bin/env node
// scripts/test-paypal-connection.mjs
// Test PayPal API connectivity and authentication

import { getPayPalAccessToken } from '../src/paypal-api.mjs';
import '../src/load-env.mjs';

async function testPayPalConnection() {
    console.log('🔍 Testing PayPal API Connection');
    console.log('='.repeat(60));

    // Check environment
    console.log('\n📋 Configuration:');
    const rawMode = process.env.PAYPAL_MODE || 'sandbox';
    const modeLower = String(rawMode).toLowerCase();
    const isLive = modeLower === 'live' || modeLower === 'receive_live';
    const mode = rawMode;
    const apiBase = process.env.PAYPAL_API_BASE_URL ||
        (modeLower === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');

    console.log(`   Mode: ${mode}`);
    console.log(`   API Base: ${apiBase}`);

    if (!isLive) {
        console.warn(`\n⚠️  WARNING: PayPal is in ${String(mode).toUpperCase()} mode`);
        console.warn(`   For production, set PAYPAL_MODE=live`);
    }

    // Check credentials
    const hasClientId = !!process.env.PAYPAL_CLIENT_ID;
    const hasClientSecret = !!process.env.PAYPAL_CLIENT_SECRET;

    console.log(`\n🔑 Credentials:`);
    console.log(`   Client ID: ${hasClientId ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Client Secret: ${hasClientSecret ? '✅ Set' : '❌ Missing'}`);

    if (!hasClientId || !hasClientSecret) {
        console.error('\n❌ Missing PayPal credentials');
        console.error('   Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
        process.exit(1);
    }

    // Test authentication
    console.log('\n🔐 Testing authentication...');
    try {
        const token = await getPayPalAccessToken();

        if (token && token.length > 0) {
            console.log(`   ✅ Authentication successful`);
            console.log(`   Token: ${token.substring(0, 20)}...`);
            console.log(`   Token length: ${token.length} characters`);
        } else {
            console.error('   ❌ Authentication failed: Empty token');
            process.exit(1);
        }
    } catch (error) {
        console.error(`   ❌ Authentication failed: ${error.message}`);

        if (error.message.includes('401')) {
            console.error('\n   Possible causes:');
            console.error('   - Invalid Client ID or Secret');
            console.error('   - Credentials are for wrong mode (sandbox vs live)');
        } else if (error.message.includes('timeout')) {
            console.error('\n   Possible causes:');
            console.error('   - Network connectivity issues');
            console.error('   - PayPal API is down');
        }

        process.exit(1);
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ PayPal API Connection Test PASSED');
    console.log('='.repeat(60));
    console.log('\n✓ PayPal API is accessible');
    console.log('✓ Authentication is working');
    console.log(`✓ Mode: ${String(mode).toUpperCase()}`);

    if (isLive) {
        console.log('\n🚀 Ready for LIVE payouts');
    } else {
        console.log('\n⚠️  Running in SANDBOX mode - no real money will be transferred');
    }
}

// Run test
testPayPalConnection().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
