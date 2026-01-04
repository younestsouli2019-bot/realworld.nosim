import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.resolve(ROOT_DIR, 'backups');

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
        ensureDirectoryExists(dest);
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

async function runBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(BACKUP_ROOT, timestamp);
    
    console.log(`🛡️  STARTING DISASTER RECOVERY BACKUP...`);
    console.log(`📂 Destination: ${backupDir}`);
    
    ensureDirectoryExists(backupDir);

    // Critical Data Directories to Backup
    const criticalDirs = ['data', 'config', 'exports'];
    
    for (const dir of criticalDirs) {
        const srcPath = path.join(ROOT_DIR, dir);
        const destPath = path.join(backupDir, dir);
        
        if (fs.existsSync(srcPath)) {
            console.log(`   - Backing up: ${dir}...`);
            copyRecursiveSync(srcPath, destPath);
        } else {
            console.warn(`   ⚠️  Warning: ${dir} not found, skipping.`);
        }
    }
    
    // Backup .env (WARNING: Contains secrets, ensure backup location is secure)
    // For this implementation, we will skip .env to avoid accidental exposure in unencrypted backups
    // Instead, we backup a template if it exists
    if (fs.existsSync(path.join(ROOT_DIR, '.env.example'))) {
         fs.copyFileSync(path.join(ROOT_DIR, '.env.example'), path.join(backupDir, '.env.example'));
    }

    console.log(`✅ BACKUP COMPLETED SUCCESSFULLY.`);
    console.log(`   Path: ${backupDir}`);
}

runBackup().catch(err => {
    console.error('❌ BACKUP FAILED:', err);
    process.exit(1);
});
