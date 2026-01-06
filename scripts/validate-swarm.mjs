import '../src/load-env.mjs';
import { validateSwarm } from '../src/bootstrap/constitution-validator.mjs';
import { agentOath, CONSTITUTION_TEXT } from '../src/policy/constitution.mjs';

async function main() {
  const res = validateSwarm();
  const oath = agentOath();
  const output = { validation: res, oath, constitution_summary: CONSTITUTION_TEXT };
  console.log(JSON.stringify(output, null, 2));
  if (!res.ok) process.exit(1);
}

main();

