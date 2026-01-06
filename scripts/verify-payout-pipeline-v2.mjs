
import '../src/load-env.mjs';
import { ExternalGatewayManager } from '../src/finance/ExternalGatewayManager.mjs';

// Mock Dependencies for standalone test
class MockStorage {
    load() { return null; }
    save(type, id, data) { return { id, ...data }; }
}
class MockAudit {
    log(action, ...args) { console.log(`📝 [AUDIT] ${action}`, args[0]); }
}
class MockExecutor {
    execute(key, fn) { return fn(); }
}

async function verify() {
    console.log("🔍 Verifying Financial Pipeline Connections (V2)...");
    
    // Check Env Vars explicitly
    const required = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`❌ Missing Env Vars: ${missing.join(', ')}`);
        process.exit(1);
    }
    console.log("✅ Credentials present in environment.");

    const gateway = new ExternalGatewayManager(
        new MockStorage(),
        new MockAudit(),
        new MockExecutor()
    );

    // 1. Check Connectivity (Balance)
    try {
        console.log("1️⃣  Testing PayPal Balance Connectivity...");
        const balance = await gateway.getPayPalBalance('Verifier');
        console.log("   ✅ Connection Successful. Balance Data Received.");
        console.log("   💰 Balance:", JSON.stringify(balance, null, 2));
    } catch (e) {
        console.error("   ❌ Connection Failed:", e.message);
        // If it's an auth error, we know the creds are wrong/expired
        if (e.message.includes('401') || e.message.includes('Auth')) {
             console.error("   ⚠️  Authentication Error. Please check Client ID/Secret in .env");
        }
        process.exit(1);
    }

    console.log("\n✨ PIPELINE VERIFIED. READY FOR PAYOUT RECOVERY.");
}

verify();
