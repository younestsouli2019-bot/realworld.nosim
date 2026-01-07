import crypto from 'node:crypto';

const challenges = new Map();
const tokens = new Map();

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

function nowMs() {
  return Date.now();
}

function ttlMs(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1000) return fallback;
  return n;
}

export function issueOwnerChallenge() {
  const id = randomId();
  const challenge = crypto.randomBytes(32).toString('base64');
  const expires = nowMs() + ttlMs(process.env.OWNER_AUTH_CHALLENGE_TTL_MS ?? '300000', 300000);
  challenges.set(id, { challenge, expires });
  return { id, challenge, expiresAt: new Date(expires).toISOString() };
}

function readOwnerPublicKey() {
  const pem = process.env.OWNER_MOBILE_PUBLIC_KEY || '';
  if (!pem || !pem.trim()) return null;
  return pem;
}

function computeToken(id, challenge) {
  const secret = process.env.AUDIT_HMAC_SECRET || process.env.CONSTITUTION_RUNTIME_SECRET || '';
  if (!secret) return null;
  const msg = `${id}:${challenge}:${nowMs()}`;
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

export function verifyOwnerChallenge(id, signatureB64) {
  const entry = challenges.get(String(id));
  if (!entry) return { ok: false, error: 'invalid_challenge_id' };
  if (entry.expires < nowMs()) {
    challenges.delete(String(id));
    return { ok: false, error: 'challenge_expired' };
  }
  const pub = readOwnerPublicKey();
  if (!pub) return { ok: false, error: 'missing_owner_public_key' };
  const sig = Buffer.from(String(signatureB64 || ''), 'base64');
  const data = Buffer.from(entry.challenge, 'utf8');
  const ok = crypto.verify(null, data, pub, sig);
  if (!ok) return { ok: false, error: 'invalid_signature' };
  const token = computeToken(String(id), entry.challenge);
  if (!token) return { ok: false, error: 'missing_runtime_secret' };
  const expires = nowMs() + ttlMs(process.env.OWNER_AUTH_TOKEN_TTL_MS ?? '900000', 900000);
  tokens.set(token, { expires });
  challenges.delete(String(id));
  return { ok: true, token, expiresAt: new Date(expires).toISOString() };
}

export function validateOwnerToken(token) {
  const t = tokens.get(String(token));
  if (!t) return false;
  if (t.expires < nowMs()) {
    tokens.delete(String(token));
    return false;
  }
  return true;
}
