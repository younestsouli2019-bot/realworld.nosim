// owner-sign.js
import fs from 'fs';
import crypto from 'crypto';

// 1. Calculate the hash of the constitution locally to ensure it matches
// what the developers sent you.
const constitutionContent = fs.readFileSync('./swarm.constitution.json', 'utf8');
const constitutionHash = crypto.createHash('sha256').update(constitutionContent).digest('hex');

console.log(`Constitution Hash: ${constitutionHash}`);

// Verify this hash matches the 'constitution.hash.txt' provided by the team
// before proceeding. (Manual check or automated)
const providedHash = fs.readFileSync('./constitution.hash.txt', 'utf8').trim();

if (constitutionHash !== providedHash) {
  console.error('❌ SECURITY ALERT: The provided hash file does not match the constitution JSON!');
  process.exit(1);
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