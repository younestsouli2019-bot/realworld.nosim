import fs from 'fs';
import path from 'path';

function readEnvFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function writeEnvFile(p, content) {
  fs.writeFileSync(p, content);
}

function upsertKey(lines, key, val) {
  const idx = lines.findIndex(l => l.trim().startsWith(`${key}=`));
  const line = `${key}=${val}`;
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
}

function run() {
  const envPath = path.join(process.cwd(), '.env');
  const content = readEnvFile(envPath);
  const lines = content ? content.split(/\r?\n/) : [];
  upsertKey(lines, 'SWARM_LIVE', 'true');
  upsertKey(lines, 'PAYONEER_MODE', 'PAYOUT');
  upsertKey(lines, 'PAYPAL_MODE', 'PAYOUT');
  upsertKey(lines, 'CRYPTO_MODE', 'SEND');
  const updated = lines.filter(Boolean).join('\n') + '\n';
  writeEnvFile(envPath, updated);
  console.log('LIVE_MODES_ACTIVATED');
  console.log(envPath);
}

run();
