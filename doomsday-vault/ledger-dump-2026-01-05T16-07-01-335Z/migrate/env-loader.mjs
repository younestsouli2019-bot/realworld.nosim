
import fs from 'fs';
import path from 'path';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // Remove quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Don't overwrite existing env vars if already set (e.g. by shell)
    if (!process.env[key]) {
       process.env[key] = val;
    }
  });
}

// Load .env from root
loadEnv(path.resolve(process.cwd(), '.env'));
// Load .env.migration from migrate/
loadEnv(path.resolve(process.cwd(), 'migrate', '.env.migration'));
