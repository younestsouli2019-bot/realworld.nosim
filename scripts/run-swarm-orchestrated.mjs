
import { runRevenueSwarm } from '../src/revenue/swarm-runner.mjs';

console.log('--- Launcher Starting ---');
runRevenueSwarm().then(() => {
    console.log('--- Launcher Finished ---');
}).catch(err => {
    console.error('--- Launcher Failed ---', err);
});
