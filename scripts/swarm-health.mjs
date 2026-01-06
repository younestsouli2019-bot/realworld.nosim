import '../src/load-env.mjs';
import { check } from '../src/monitor/SwarmHealth.mjs';

async function main() {
  const res = check();
  console.log(JSON.stringify(res, null, 2));
}

main();

