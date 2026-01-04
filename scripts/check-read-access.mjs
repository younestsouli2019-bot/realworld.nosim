
import { buildBase44Client } from '../src/base44-client.mjs';
import '../src/load-env.mjs';

async function checkReadAccess() {
  const base44 = await buildBase44Client();
  if (!base44) return;

  const entities = ['PayoutBatch', 'PayoutItem', 'Earning', 'RevenueEvent'];
  
  for (const name of entities) {
      try {
          console.log(`Checking access to ${name}...`);
          const entity = base44.asServiceRole.entities[name];
          const records = await entity.list({ page: 1, pageSize: 1 });
          console.log(`✅ ${name}: Accessible. Found ${records.items ? records.items.length : 0} records.`);
      } catch (err) {
          console.log(`❌ ${name}: Failed. ${err.message}`);
      }
  }
}

checkReadAccess().catch(console.error);
