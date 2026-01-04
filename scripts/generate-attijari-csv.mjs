
import fs from 'fs';
import path from 'path';

const BATCH_FILE = 'c:\\Users\\Dell\\Downloads\\Nouveau dossier (3)\\data\\autonomous\\ledger\\payout_BATCH_1767462284000.json';
const EXPORT_DIR = 'c:\\Users\\Dell\\Downloads\\Nouveau dossier (3)\\exports\\bank-wire';

const OWNER_BANK = '007810000448500030594182'; // Attijariwafa

function main() {
  console.log('Restoring missing Attijari CSV...');
  
  if (!fs.existsSync(BATCH_FILE)) {
    console.error('Batch file not found!');
    process.exit(1);
  }

  const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'));
  
  const headers = [
    'Beneficiary Account',
    'Amount',
    'Currency',
    'Reference',
    'Date',
    'Description'
  ];

  const rows = batch.items.map(item => [
    OWNER_BANK,
    item.amount.toFixed(2),
    item.currency,
    item.item_id,
    new Date().toISOString().split('T')[0],
    `Autonomous revenue settlement - ${item.earning_id}`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const filename = `bank_wire_${batch.batch_id}_restored.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  fs.writeFileSync(filepath, csvContent);
  
  console.log(`✅ CSV Restored: ${filepath}`);
}

main();
