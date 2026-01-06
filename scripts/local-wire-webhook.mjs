import '../src/load-env.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const port = Number(process.env.WIRE_LOCAL_PORT || 5055);

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/wire-submissions')) {
    res.statusCode = 404;
    return res.end('Not Found');
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const outDir = path.resolve(process.cwd(), 'out', 'received');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
    const file = path.join(outDir, `wire_${Date.now()}.json`);
    fs.writeFileSync(file, body);
    const secret = process.env.WIRE_SUBMIT_SECRET || '';
    const sig = req.headers['x-wire-signature'] || '';
    let ok = true;
    if (secret) {
      const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
      ok = String(sig) === h;
    }
    const reply = JSON.stringify({ status: ok ? 'received' : 'invalid_signature', file });
    res.statusCode = ok ? 200 : 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(reply);
  });
});

server.listen(port, () => {
  console.log(`WIRE WEBHOOK http://localhost:${port}/wire-submissions`);
});

