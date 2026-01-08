import '../src/load-env.mjs';
import { validateSwarm } from '../src/bootstrap/constitution-validator.mjs';
import { enforceConstitutionSoft, getConstitutionState } from '../src/bootstrap/constitution-validator.mjs';
import { agentOath, CONSTITUTION_TEXT } from '../src/policy/constitution.mjs';
import fs from 'fs';
import path from 'path';

async function main() {
  const res = validateSwarm();
  const oath = agentOath();
  const key_guard = {
    exists: fs.existsSync('./owner_private.key'),
    backupExists: fs.existsSync('./backup/owner_private.key.enc')
  };
  const signatureSrc = path.join(process.cwd(), 'owner.signature');
  const signatureDestDir = path.join(process.cwd(), 'data', 'security');
  const signatureDest = path.join(signatureDestDir, 'owner.signature');
  let signature = { present: false, copied: false, path: null };
  try {
    if (fs.existsSync(signatureSrc)) {
      signature.present = true;
      if (!fs.existsSync(signatureDestDir)) fs.mkdirSync(signatureDestDir, { recursive: true });
      fs.copyFileSync(signatureSrc, signatureDest);
      signature.copied = true;
      signature.path = signatureDest;
    }
  } catch {}
  const output = { validation: res, oath, constitution_summary: CONSTITUTION_TEXT, key_guard, signature };
  console.log(JSON.stringify(output, null, 2));
  if (!res.ok) process.exit(1);
}

main();
