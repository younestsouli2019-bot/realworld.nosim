import fs from 'node:fs';
import crypto from 'node:crypto';
import { OWNER_ACCOUNTS, ALLOWED_BENEFICIARIES } from '../policy/RecipientRegistry.mjs';
import { PRIME_DIRECTIVE } from '../policy/constitution.mjs';
import { globalRecorder } from '../swarm/flight-recorder.mjs';

export function validateSwarm() {
  const issues = [];
  if (!PRIME_DIRECTIVE || PRIME_DIRECTIVE.length < 10) issues.push('prime_directive_missing');
  if (!OWNER_ACCOUNTS?.bank?.rib) issues.push('owner_bank_missing');
  if (!OWNER_ACCOUNTS?.payoneer?.email) issues.push('owner_payoneer_missing');
  if (!OWNER_ACCOUNTS?.paypal?.email) issues.push('owner_paypal_missing');
  if (!OWNER_ACCOUNTS?.crypto?.address) issues.push('owner_crypto_missing');
  if (!Array.isArray(ALLOWED_BENEFICIARIES) || ALLOWED_BENEFICIARIES.length === 0) issues.push('beneficiaries_missing');
  const ok = issues.length === 0;
  return { ok, issues };
}

function readTextOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8').trim();
  } catch {
    return null;
  }
}

function readBufferOrNull(p) {
  try {
    return Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'base64');
  } catch {
    return null;
  }
}

export function computeHmacSeal(hash, secret) {
  const s = String(secret || '');
  if (!s) return null;
  return crypto.createHmac('sha256', s).update(hash).digest('hex');
}

export function computeConstitutionHashFromFile(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const obj = JSON.parse(raw);
    const keys = Object.keys(obj).sort();
    const ordered = {};
    for (const k of keys) ordered[k] = obj[k];
    const txt = JSON.stringify(ordered);
    return crypto.createHash('sha256').update(txt, 'utf8').digest('hex');
  } catch {
    return null;
  }
}

export function enforceMultiSigConstitution(runtimeSecret) {
  const enabled = String(process.env.CONSTITUTION_ENFORCE || 'false').toLowerCase() === 'true';
  if (!enabled) return { enforced: false };
  const signatureOnly = String(process.env.SIGNATURE_ONLY_MODE || process.env.OWNER_SIGNATURE_ONLY || 'false').toLowerCase() === 'true';
  const signaturePermanent = String(process.env.OWNER_SIGNATURE_PERMANENT || process.env.SIGNATURE_PERMANENT || 'false').toLowerCase() === 'true';
  const maxAgeHours = Number(process.env.OWNER_SIGNATURE_MAX_AGE_HOURS || 72);
  const revoked = String(process.env.OWNER_SIGNATURE_REVOKE || 'false').toLowerCase() === 'true' || (() => {
    try { return fs.existsSync('./owner.signature.revoked'); } catch { return false; }
  })();
  const ownerPubPath = process.env.OWNER_PUBLIC_KEY_FILE || './owner_public.key';
  const masterPubPath = process.env.MASTER_PUBLIC_KEY_FILE || './masteragent_public.key';
  const ownerSigPath = process.env.OWNER_SIGNATURE_FILE || './owner.signature';
  const masterSigPath = process.env.MASTER_SIGNATURE_FILE || './masteragent.signature';
  const hashPath = process.env.CONSTITUTION_HASH_FILE || './constitution.hash.txt';
  const hmacPath = process.env.CONSTITUTION_HMAC_FILE || './constitution.hmac.txt';
  const expectedHash = readTextOrNull(hashPath);
  const jsonPath = process.env.CONSTITUTION_JSON_FILE || './swarm.constitution.json';
  const hash = computeConstitutionHashFromFile(jsonPath);
  if (!expectedHash || !hash || expectedHash !== hash) {
    process.exit(101);
  }
  if (signatureOnly || signaturePermanent) {
    if (revoked) process.exit(107);
    const sig = readTextOrNull(ownerSigPath);
    if (!sig || sig.length < 10) process.exit(102);
    try {
      if (!signaturePermanent) {
        const stat = fs.statSync(ownerSigPath);
        const ageH = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
        if (ageH > maxAgeHours) process.exit(106);
      }
    } catch {}
    return { enforced: true, ok: true, mode: signaturePermanent ? 'signature_permanent' : 'signature_only' };
  }
  const ownerSig = readBufferOrNull(ownerSigPath);
  const masterSig = readBufferOrNull(masterSigPath);
  const ownerPub = readTextOrNull(ownerPubPath);
  const masterPub = readTextOrNull(masterPubPath);
  if (!ownerSig || !masterSig || !ownerPub || !masterPub) {
    process.exit(102);
  }
  const ownerOk = crypto.verify(null, Buffer.from(hash), ownerPub, ownerSig);
  if (!ownerOk) process.exit(103);
  const masterOk = crypto.verify(null, Buffer.from(hash), masterPub, masterSig);
  if (!masterOk) process.exit(104);
  const expectedHmac = readTextOrNull(hmacPath);
  const actualHmac = computeHmacSeal(hash, runtimeSecret);
  if (!expectedHmac || !actualHmac || expectedHmac !== actualHmac) {
    process.exit(105);
  }
  return { enforced: true, ok: true };
}

// Soft (non-blocking) verification with in-memory caching
let __constitution_state = {
  lastCheckAt: null,
  lastVerifiedAt: null,
  lastValidHash: null,
  lastError: null,
  verifying: false
};

export function getConstitutionState() {
  return { ...__constitution_state };
}

export async function startAsyncVerification(runtimeSecret) {
  if (__constitution_state.verifying) return getConstitutionState();
  __constitution_state.verifying = true;
  __constitution_state.lastCheckAt = new Date().toISOString();
  const signatureOnly = String(process.env.SIGNATURE_ONLY_MODE || process.env.OWNER_SIGNATURE_ONLY || 'false').toLowerCase() === 'true';
  const signaturePermanent = String(process.env.OWNER_SIGNATURE_PERMANENT || process.env.SIGNATURE_PERMANENT || 'false').toLowerCase() === 'true';
  const maxAgeHours = Number(process.env.OWNER_SIGNATURE_MAX_AGE_HOURS || 72);
  const revoked = String(process.env.OWNER_SIGNATURE_REVOKE || 'false').toLowerCase() === 'true' || (() => {
    try { return fs.existsSync('./owner.signature.revoked'); } catch { return false; }
  })();
  const ownerPubPath = process.env.OWNER_PUBLIC_KEY_FILE || './owner_public.key';
  const masterPubPath = process.env.MASTER_PUBLIC_KEY_FILE || './masteragent_public.key';
  const ownerSigPath = process.env.OWNER_SIGNATURE_FILE || './owner.signature';
  const masterSigPath = process.env.MASTER_SIGNATURE_FILE || './masteragent.signature';
  const hashPath = process.env.CONSTITUTION_HASH_FILE || './constitution.hash.txt';
  const hmacPath = process.env.CONSTITUTION_HMAC_FILE || './constitution.hmac.txt';
  const jsonPath = process.env.CONSTITUTION_JSON_FILE || './swarm.constitution.json';
  try {
    const expectedHash = readTextOrNull(hashPath);
    const hash = computeConstitutionHashFromFile(jsonPath);
    if (!expectedHash || !hash || expectedHash !== hash) {
      throw new Error('hash_mismatch');
    }
    if (signatureOnly || signaturePermanent) {
      if (revoked) throw new Error('owner_signature_revoked');
      const sigTxt = readTextOrNull(ownerSigPath);
      if (!sigTxt || sigTxt.length < 10) throw new Error('owner_signature_missing');
      try {
        if (!signaturePermanent) {
          const stat = fs.statSync(ownerSigPath);
          const ageH = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
          if (ageH > maxAgeHours) throw new Error('owner_signature_stale');
        }
      } catch {}
      __constitution_state.lastValidHash = hash;
      __constitution_state.lastVerifiedAt = new Date().toISOString();
      __constitution_state.lastError = null;
      try { globalRecorder.info('Constitution verified (signature-only)'); } catch {}
      return getConstitutionState();
    }
    const ownerSig = readBufferOrNull(ownerSigPath);
    const masterSig = readBufferOrNull(masterSigPath);
    const ownerPub = readTextOrNull(ownerPubPath);
    const masterPub = readTextOrNull(masterPubPath);
    if (!ownerSig || !masterSig || !ownerPub || !masterPub) {
      throw new Error('missing_keys_or_signatures');
    }
    const ownerOk = crypto.verify(null, Buffer.from(hash), ownerPub, ownerSig);
    if (!ownerOk) throw new Error('owner_signature_invalid');
    const masterOk = crypto.verify(null, Buffer.from(hash), masterPub, masterSig);
    if (!masterOk) throw new Error('master_signature_invalid');
    const expectedHmac = readTextOrNull(hmacPath);
    const actualHmac = computeHmacSeal(hash, runtimeSecret);
    if (!expectedHmac || !actualHmac || expectedHmac !== actualHmac) {
      throw new Error('hmac_mismatch');
    }
    __constitution_state.lastValidHash = hash;
    __constitution_state.lastVerifiedAt = new Date().toISOString();
    __constitution_state.lastError = null;
    try { globalRecorder.info('Constitution verified (soft mode)'); } catch {}
  } catch (e) {
    __constitution_state.lastError = e?.message || 'verification_failed';
    try { globalRecorder.warn(`Constitution verification failed: ${__constitution_state.lastError}`); } catch {}
  } finally {
    __constitution_state.verifying = false;
  }
  return getConstitutionState();
}

export function enforceConstitutionSoft(runtimeSecret) {
  const enabled = String(process.env.CONSTITUTION_ENFORCE || 'false').toLowerCase() === 'true';
  if (!enabled) return { enforced: false };
  // kick off async verification, don't block startup
  startAsyncVerification(runtimeSecret);
  return getConstitutionState();
}
