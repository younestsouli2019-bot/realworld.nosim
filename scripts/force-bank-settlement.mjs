
import { AutonomousSettlementEngine } from '../data/full_autonomous_system.js';

console.log('FORCE EXECUTING BANK SETTLEMENT...');

const engine = new AutonomousSettlementEngine();

// Force immediate execution
await engine.scan();

console.log('DONE.');
process.exit(0);
