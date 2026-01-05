import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), '.hard-binding.json');

export function isHardBindingActive() {
  try {
    if (!fs.existsSync(STATE_FILE)) return false;
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return !!s.active;
  } catch {
    return false;
  }
}

export function setHardBindingActive(active) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ active: !!active, updatedAt: new Date().toISOString() }, null, 2));
    return true;
  } catch {
    return false;
  }
}
