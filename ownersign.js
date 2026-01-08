// owner-sign.js
import fs from 'fs';
import crypto from 'crypto';
import './src/load-env.mjs';
import { computeConstitutionHashFromFile } from './src/bootstrap/constitution-validator.mjs';

const constitutionHash = computeConstitutionHashFromFile('./swarm.constitution.json');

console.log(`Constitution Hash: ${constitutionHash}`);

const providedHash = fs.readFileSync('./constitution.hash.txt', 'utf8').trim();

if (constitutionHash !== providedHash) {
  console.error('❌ SECURITY ALERT: The provided hash file does not match the constitution JSON!');
  process.exit(1);
}

function decryptBackup(json, secret) {
  const salt = Buffer.from(String(json.s), 'hex');
  const key = crypto.scryptSync(String(secret), salt, 32);
  const iv = Buffer.from(String(json.iv), 'hex');
  const tag = Buffer.from(String(json.tag), 'hex');
  const ct = Buffer.from(String(json.ct), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

try {
  fs.accessSync('./owner_private.key');
} catch {
  const backupPath = './backup/owner_private.key.enc';
  if (fs.existsSync(backupPath)) {
    const secret = (process.env.OWNER_KEY_BACKUP_SECRET || process.env.CONSTITUTION_RUNTIME_SECRET || '').trim();
    if (!secret) {
      console.error('Missing backup secret; cannot restore owner_private.key');
      process.exit(2);
    }
    const raw = fs.readFileSync(backupPath, 'utf8');
    const parsed = JSON.parse(raw);
    const plain = decryptBackup(parsed, secret);
    fs.writeFileSync('./owner_private.key', plain, 'utf8');
    console.log('♻️ Restored owner_private.key from encrypted backup.');
  } else {
    console.error('owner_private.key not found and no backup available.');
    process.exit(3);
  }
}

// 2. Load the Offline Private Key
const ownerPrivateKey = fs.readFileSync('./owner_private.key');

// 3. Sign the Hash
const signature = crypto.sign(
  null, // No specific OID required for Ed25519 in Node usually
  Buffer.from(constitutionHash),
  { key: ownerPrivateKey, format: 'pem', type: 'pkcs8' }
);

// 4. Output the Signature
const signatureB64 = signature.toString('base64');
fs.writeFileSync('./owner.signature', signatureB64);

console.log('✅ Owner Signature Generated: owner.signature');
console.log('📤 Copy owner.signature to the Swarm repository.');
