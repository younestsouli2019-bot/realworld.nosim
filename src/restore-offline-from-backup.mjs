
import fs from 'fs';
import path from 'path';

const BACKUPS_DIR = path.resolve('backups');
const OFFLINE_STORE_PATH = path.resolve('.base44-offline-store.json');

function getLatestBackupDir() {
  if (!fs.existsSync(BACKUPS_DIR)) return null;
  const entries = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort().reverse();
  return dirs.length > 0 ? path.join(BACKUPS_DIR, dirs[0]) : null;
}

function restoreFromBackup() {
  console.log('🔄 RESTORING OFFLINE STORE FROM BACKUP...');
  
  const backupDir = getLatestBackupDir();
  if (!backupDir) {
    console.error('❌ No backups found in backups/ directory.');
    process.exit(1);
  }
  
  console.log(`📂 Using backup: ${backupDir}`);
  
  const store = { entities: {} };
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json') && f !== 'backup-summary.json');
  
  for (const file of files) {
    const entityName = path.basename(file, '.json');
    console.log(`  -> Loading ${entityName}...`);
    
    try {
      const records = JSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
      store.entities[entityName] = { records: Array.isArray(records) ? records : [] };
      console.log(`     ✅ Loaded ${store.entities[entityName].records.length} records.`);
    } catch (e) {
      console.warn(`     ⚠️ Failed to parse ${file}: ${e.message}`);
      store.entities[entityName] = { records: [] };
    }
  }
  
  fs.writeFileSync(OFFLINE_STORE_PATH, JSON.stringify(store, null, 2));
  console.log(`✅ Offline store restored at ${OFFLINE_STORE_PATH}`);
}

restoreFromBackup();
