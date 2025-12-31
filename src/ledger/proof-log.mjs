import fs from 'fs';
import path from 'path';

const PROOF_LOG_PATH = path.join(process.cwd(), 'data', 'proof-of-funds.log');

// Ensure data dir exists
const dir = path.dirname(PROOF_LOG_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

export async function appendProof(entry) {
    const line = JSON.stringify({
        ...entry,
        logged_at: new Date().toISOString()
    }) + '\n';
    
    await fs.promises.appendFile(PROOF_LOG_PATH, line, 'utf8');
    return true;
}
