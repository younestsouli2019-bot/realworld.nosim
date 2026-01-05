import fs from 'fs';
import path from 'path';

const p = path.join(process.cwd(), '.auto-settlement.json');
fs.writeFileSync(p, JSON.stringify({ active: true, updatedAt: new Date().toISOString() }, null, 2));
console.log('AUTO_SETTLEMENT_ACTIVE');
