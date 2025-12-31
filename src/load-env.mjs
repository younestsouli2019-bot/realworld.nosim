import fs from 'node:fs';
import path from 'node:path';

export function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        // remove quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        // Only set if not already set (or overwrite? usually .env overwrites defaults but process.env takes precedence)
        // Standard dotenv behavior: don't overwrite existing process.env
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    // ignore if .env missing
  }
}

// Auto-load when imported
loadEnv();
