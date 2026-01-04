
import { SwarmOrchestrator } from '../src/orchestration/SwarmOrchestrator.mjs';

async function testOrchestrator() {
  console.log('🧪 TESTING SWARM ORCHESTRATOR...');
  
  const swarm = new SwarmOrchestrator();
  await swarm.start();
  
  swarm.registerAgent('AGENT_ALPHA', ['CRYPTO_SETTLEMENT', 'RESEARCH']);
  
  // Test 1: Successful Task
  console.log('\n--- Test 1: Successful Task ---');
  await swarm.executeTask({
    id: 'TASK_001',
    requiredCapabilities: ['CRYPTO_SETTLEMENT'],
    resourceKey: 'BINANCE_API'
  });
  
  // Test 2: Rate Limit Trigger (Burst)
  console.log('\n--- Test 2: Rate Limit Trigger ---');
  // We registered 10 burst. Let's fire 12 tasks rapidly.
  for (let i = 0; i < 12; i++) {
    const res = await swarm.executeTask({
        id: `BURST_TASK_${i}`,
        requiredCapabilities: ['CRYPTO_SETTLEMENT'],
        resourceKey: 'BINANCE_API'
    });
    console.log(`Task ${i}: ${res.status} ${res.retryAfter ? `(Retry in ${res.retryAfter}ms)` : ''}`);
  }
  
  // Test 3: Failure Handling
  console.log('\n--- Test 3: Failure Handling (Simulated) ---');
  // We mock a failure by forcing the handler directly since we can't easily inject failure into executeTask without a mock agent.
  // Actually, let's just use the failure handler directly to prove it calculates backoff.
  const task = { id: 'FAILING_TASK' };
  const error = new Error('503 Service Unavailable');
  
  console.log('Attempt 1 (First failure):');
  console.log(swarm.failureHandler.handleFailure(task, error));
  
  console.log('Attempt 2 (Second failure):');
  console.log(swarm.failureHandler.handleFailure(task, error));
  
  console.log('Attempt 6 (Permanent failure):');
  task.attempts = 5;
  console.log(swarm.failureHandler.handleFailure(task, error));

  swarm.stop();
}

testOrchestrator();
