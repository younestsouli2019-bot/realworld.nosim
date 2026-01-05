import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class BankGateway {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'settlements', 'bank_wires');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generates a Bank Wire Batch CSV
     * @param {Array} transactions - List of { amount, currency, destination, reference }
     * @returns {Object} result - { status, filePath, batchId }
     */
    async generateBatch(transactions) {
        const batchId = `BANK_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        const filename = `bank_wire_batch_${batchId}.csv`;
        const filePath = path.join(this.outputDir, filename);

        // Standard Banking CSV Format (Generic)
        const header = "Reference,BeneficiaryAccount,BeneficiaryName,Amount,Currency,BankCode\n";
        
        const rows = transactions.map((tx, index) => {
            const ref = tx.reference || `Settlement ${batchId}-${index+1}`;
            // Destination is expected to be the RIB/IBAN
            const account = tx.destination; 
            const name = "Younes Tsouli"; // Hardcoded Owner Name
            
            return `${ref},${account},${name},${tx.amount.toFixed(2)},${tx.currency},ATTIJARI_MA`;
        });

        const content = header + rows.join('\n');
        
        fs.writeFileSync(filePath, content);
        
        console.log(`\n🏦 [BankGateway] Generated Wire Batch: ${filePath}`);
        console.log(`   ⚠️  ACTION REQUIRED: Upload this CSV to Bank Portal (Attijari).`);

        return {
            status: 'WAITING_UPLOAD',
            filePath,
            batchId,
            instruction: 'Upload CSV to Bank Portal'
        };
    }
}
