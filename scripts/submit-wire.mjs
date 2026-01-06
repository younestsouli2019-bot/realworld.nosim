import '../src/load-env.mjs';
import { submitWire } from '../src/financial/broadcast/WireSubmissionBroadcaster.mjs';

async function main() {
  const res = await submitWire();
  console.log(JSON.stringify(res, null, 2));
}

main();

