
import '../src/load-env.mjs';
import { Base44Pusher, SCHEMAS } from './push-to-base44.mjs';
import { buildBase44Client } from '../src/base44-client.mjs';

async function main() {
  const args = process.argv.slice(2);
  // ... (args parsing) ...
  const type = args[0]?.toUpperCase();
  const content = args[1];
  const priority = args[2]?.toUpperCase() || 'MEDIUM';
  const agentId = process.env.AGENT_ID || 'autonomous-daemon';

  if (!type || !content) {
    console.error('Usage: node scripts/agent-feedback.mjs <TYPE> <CONTENT> [PRIORITY]');
    console.error('Types: ESCALATION, SUGGESTION, UPGRADE_REQUEST');
    process.exit(1);
  }

  const validTypes = ['ESCALATION', 'SUGGESTION', 'UPGRADE_REQUEST'];
  if (!validTypes.includes(type)) {
    console.error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  console.log(`🤖 Agent Feedback: Submitting ${type}...`);

  const config = {
    appId: process.env.BASE44_APP_ID,
    serviceToken: process.env.BASE44_SERVICE_TOKEN,
    apiUrl: process.env.BASE44_API_URL || 'https://api.base44.com/v1'
  };

  const pusher = new Base44Pusher(config);

  const feedback = {
    feedback_id: `FB_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    agent_id: agentId,
    type: type,
    content: content,
    priority: priority,
    context: {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version,
      source: 'agent-feedback-script'
    },
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  try {
    if (!config.appId || !config.serviceToken) {
       throw new Error('Missing BASE44_APP_ID or BASE44_SERVICE_TOKEN');
    }

    // 1. Ensure Schema Exists (Idempotent check)
    // ...
    const existing = await pusher.getEntity('AgentFeedback');
    if (!existing) {
        console.log('ℹ️ AgentFeedback schema missing, creating...');
        await pusher.createEntity(SCHEMAS.AgentFeedback);
    }

    // 2. Create Record
    const result = await pusher.createRecord('AgentFeedback', feedback);
    
    console.log('✅ Feedback submitted successfully!');
    console.log(`   ID: ${result.id || feedback.feedback_id}`);
    console.log(`   Status: ${feedback.status}`);

  } catch (error) {
    console.error('❌ Failed to submit feedback to Base44 API:', error.message);
    
    // FALLBACK: Write to local offline store
    try {
        console.log('⚠️ Falling back to offline store...');
        const offlineClient = buildBase44Client({ mode: 'offline' });
        const entity = offlineClient.asServiceRole.entities.AgentFeedback;
        const offlineResult = await entity.create(feedback);
        console.log('✅ Feedback saved offline!');
        console.log(`   ID: ${offlineResult.id || feedback.feedback_id}`);
    } catch (offlineError) {
        console.error('❌ Offline save failed:', offlineError.message);
        process.exit(1);
    }
  }
}

main();
