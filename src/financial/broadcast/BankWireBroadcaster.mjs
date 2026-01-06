import fs from 'node:fs';
import path from 'node:path';

export async function prepareBankWire(transactions) {
  const outDir = path.resolve(process.cwd(), 'out', 'wires');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const file = path.join(outDir, `wire_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ transactions, created_at: new Date().toISOString() }, null, 2));
  return { status: 'prepared', file };
}

