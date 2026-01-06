import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function dateFile(baseDir) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.resolve(baseDir, `${y}-${m}-${day}.jsonl`);
}

function readLastLine(fp) {
  if (!fs.existsSync(fp)) return null;
  const fd = fs.openSync(fp, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const size = stat.size;
    if (size === 0) return null;
    const chunkSize = Math.min(4096, size);
    const buf = Buffer.alloc(chunkSize);
    fs.readSync(fd, buf, 0, chunkSize, size - chunkSize);
    const text = buf.toString('utf8');
    const lines = text.trim().split(/\r?\n/g);
    const last = lines[lines.length - 1] || null;
    return last;
  } finally {
    fs.closeSync(fd);
  }
}

function canonical(obj) {
  const replacer = (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted = {};
      Object.keys(value).sort().forEach(k => { sorted[k] = value[k]; });
      return sorted;
    }
    return value;
  };
  return JSON.stringify(obj, replacer);
}

export class AppendOnlyHmacLogger {
  constructor({ baseDir = path.resolve(process.cwd(), 'audits', 'autonomous_hmac'), secretEnv = 'AUDIT_HMAC_SECRET' } = {}) {
    this.baseDir = baseDir;
    this.secretEnv = secretEnv;
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
  }
  #secret() {
    const s = process.env[this.secretEnv];
    if (!s || String(s).trim() === '') throw new Error('AUDIT_HMAC_SECRET missing');
    return s;
  }
  async write(entry) {
    const filePath = dateFile(this.baseDir);
    const prevLine = readLastLine(filePath);
    let prevHmac = null;
    if (prevLine) {
      try {
        const parsed = JSON.parse(prevLine);
        prevHmac = parsed.hmac || null;
      } catch { prevHmac = null; }
    }
    const nonce = crypto.randomUUID();
    const payload = { ...entry, nonce, prev_hmac: prevHmac };
    const body = canonical(payload);
    const hmac = crypto.createHmac('sha256', this.#secret()).update(body).digest('hex');
    const line = JSON.stringify({ ...payload, hmac });
    const fd = fs.openSync(filePath, 'a');
    try {
      fs.writeSync(fd, line + '\n');
    } finally {
      fs.closeSync(fd);
    }
    return { filePath, hmac };
  }
  static verifyFileChain(filePath, secret) {
    if (!fs.existsSync(filePath)) return { ok: true, entries: 0 };
    const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/g).filter(Boolean);
    let lastHmac = null;
    for (const line of lines) {
      const obj = JSON.parse(line);
      const prev = obj.prev_hmac || null;
      if (prev !== lastHmac) return { ok: false, error: 'chain_break' };
      const h = crypto.createHmac('sha256', secret).update(canonical({ ...obj, hmac: undefined })).digest('hex');
      if (h !== obj.hmac) return { ok: false, error: 'hmac_mismatch' };
      lastHmac = obj.hmac;
    }
    return { ok: true, entries: lines.length };
  }
}

