import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class PayoneerGateway {
    constructor(config = {}) {
        this.programId = config.program_id || process.env.PAYONEER_PROGRAM_ID || '85538995';
        this.outputDir = path.join(process.cwd(), 'settlements', 'payoneer');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generates a Mass Payout CSV for Payoneer
     * @param {Array} transactions - List of { amount, currency, destination, reference }
     * @returns {Object} result - { status, filePath, batchId }
     */
    async generateBatch(transactions) {
        const batchId = `PAY_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        const filename = `payoneer_payout_${batchId}.csv`;
        const filePath = path.join(this.outputDir, filename);

        // Header required by Payoneer Mass Payout (Generic CSV Format)
        // Standard Format: PaymentID,PayeeID,Amount,Currency,Description
        const header = "PaymentID,PayeeID,Amount,Currency,Description\n";
        
        const rows = transactions.map((tx, index) => {
            const paymentId = `${batchId}-${index+1}`;
            // Ensure PayeeID is the email or Payoneer ID
            const payeeId = tx.destination; 
            const desc = tx.reference || `Settlement ${paymentId}`;
            
            return `${paymentId},${payeeId},${tx.amount.toFixed(2)},${tx.currency},${desc}`;
        });

        const content = header + rows.join('\n');
        
        fs.writeFileSync(filePath, content);
        
        console.log(`\n💳 [PayoneerGateway] Generated Batch: ${filePath}`);
        console.log(`   ⚠️  ACTION REQUIRED: Upload this CSV to Payoneer Mass Payout Portal.`);

        return {
            status: 'WAITING_UPLOAD',
            filePath,
            batchId,
            instruction: 'Upload CSV to Payoneer'
        };
    }
}
