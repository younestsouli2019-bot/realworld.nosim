import fs from 'fs';
import path from 'path';

const DIRS = {
  bank: './exports/bank-wire',
  crypto: './exports/crypto'
};

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter(f => f.endsWith('.csv') || f.endsWith('.txt'));
}

function parseAmount(filename, content) {
  // Try to find amount in content or filename
  // Filenames are often: bank_wire_BATCH_TIMESTAMP.csv (no amount)
  // Content usually has "Amount" or total
  
  // For Bank CSV: 2nd line, 2nd column
  if (filename.endsWith('.csv')) {
    const lines = content.split('\n');
    if (lines.length > 1) {
      const parts = lines[1].split(',');
      if (parts.length > 1) return parseFloat(parts[1]);
    }
  }
  
  // For Text files (Payoneer/Crypto)
  // Look for "AMOUNT: $X USD"
  const match = content.match(/AMOUNT:\s*\$([\d.]+)/i);
  if (match) return parseFloat(match[1]);
  
  return 0;
}

function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('       💰 SETTLEMENT STATUS REPORT (INCOMING FUNDS)');
  console.log('═══════════════════════════════════════════════════════════');
  
  let totalPending = 0;
  let totalFiles = 0;
  
  // 1. BANK WIRES
  console.log('\n🏦 BANK WIRES (ATTIJARI / PAYONEER):');
  const bankFiles = scanDirectory(DIRS.bank);
  let bankTotal = 0;
  
  // Filter for unique batches (CSV and TXT often come in pairs for same batch)
  // We'll count the CSVs as the primary record for Bank
  const uniqueBatches = new Set();
  
  bankFiles.forEach(file => {
    if (file.endsWith('.csv')) {
      const content = fs.readFileSync(path.join(DIRS.bank, file), 'utf8');
      const amount = parseAmount(file, content);
      bankTotal += amount;
      totalFiles++;
      console.log(`   - ${file}: $${amount.toLocaleString()} (Ready for Upload)`);
    }
  });
  
  if (bankFiles.length === 0) console.log('   (No pending bank wires)');
  
  // 2. CRYPTO
  console.log('\n🪙 CRYPTO SETTLEMENTS (BINANCE):');
  const cryptoFiles = scanDirectory(DIRS.crypto);
  let cryptoTotal = 0;
  
  cryptoFiles.forEach(file => {
    const content = fs.readFileSync(path.join(DIRS.crypto, file), 'utf8');
    const amount = parseAmount(file, content);
    cryptoTotal += amount;
    totalFiles++;
    console.log(`   - ${file}: $${amount.toLocaleString()} (Ready for Transfer)`);
  });
  
  if (cryptoFiles.length === 0) console.log('   (No pending crypto settlements)');
  
  totalPending = bankTotal + cryptoTotal;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`💸 TOTAL PENDING "INCOMING": $${totalPending.toLocaleString()} USD`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚠️  ACTION REQUIRED:');
  console.log('   These funds are HELD in the generated artifacts.');
  console.log('   To receive money in your actual accounts, you must:');
  console.log('   1. Upload the CSV files in ./exports/bank-wire to Attijariwafa Online.');
  console.log('   2. OR Execute the Payoneer instructions in ./exports/bank-wire.');
  console.log('   3. OR Execute the Crypto transfers in ./exports/crypto.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main();
