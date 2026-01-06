import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function latestWireFile() {
  const dir = path.resolve(process.cwd(), 'out', 'wires');
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
    files.sort((a, b) => b.t - a.t);
    if (files.length === 0) return null;
    return path.join(dir, files[0].f);
  } catch {
    return null;
  }
}

export async function submitWire(filePath) {
  const url = process.env.WIRE_SUBMIT_WEBHOOK_URL || '';
  const secret = process.env.WIRE_SUBMIT_SECRET || '';
  let fp = filePath || latestWireFile();
  if (!fp) return { status: 'no_wire_files' };
  const body = fs.readFileSync(fp, 'utf8');
  if (!url) {
    const outDir = path.resolve(process.cwd(), 'out', 'submitted');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
    const dest = path.join(outDir, path.basename(fp));
    fs.copyFileSync(fp, dest);
    return { status: 'queued_local', file: dest };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Wire-Signature'] = h;
  }
  const res = await fetch(url, { method: 'POST', headers, body });
  const text = await res.text();
  return { status: res.ok ? 'submitted' : 'error', code: res.status, body: text };
}

