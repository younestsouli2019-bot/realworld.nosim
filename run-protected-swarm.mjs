
import { runRevenueSwarm } from './src/revenue/swarm-runner.mjs';

console.log('🛡️ Starting Protected Swarm Execution...');
runRevenueSwarm()
    .then(result => {
        console.log('✅ Swarm execution complete');
        // Keep process alive for WebSocket if server is running
        setTimeout(() => {
            console.log('👋 Shutting down...');
            process.exit(0);
        }, 10000);
    })
    .catch(err => {
        console.error('❌ Swarm execution failed:', err);
        process.exit(1);
    });
