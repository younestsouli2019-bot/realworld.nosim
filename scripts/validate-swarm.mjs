import '../src/load-env.mjs';
import { validateSwarm } from '../src/bootstrap/constitution-validator.mjs';
import { agentOath, CONSTITUTION_TEXT } from '../src/policy/constitution.mjs';
import fs from 'fs';

async function main() {
  const res = validateSwarm();
  const oath = agentOath();
  const key_guard = {
    exists: fs.existsSync('./owner_private.key'),
    backupExists: fs.existsSync('./backup/owner_private.key.enc')
  };
  const output = { validation: res, oath, constitution_summary: CONSTITUTION_TEXT, key_guard };
  console.log(JSON.stringify(output, null, 2));
  if (!res.ok) process.exit(1);
}

main();
