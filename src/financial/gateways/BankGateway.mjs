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
     * Generates Bank Account Details for Invoicing (Billing Mode)
     * Replaces "Wire Batch" with "Payment Instructions" for Clients.
     */
    async generateBatch(transactions) {
        const batchId = `BANK_INVOICE_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        const filename = `bank_payment_instructions_${batchId}.csv`;
        const filePath = path.join(this.outputDir, filename);

        // Header for Payment Request / Invoice List
        const header = "ClientToBill,Amount,Currency,OwnerBankName,OwnerIBAN,OwnerName,SwiftCode\n";
        
        const rows = transactions.map((tx, index) => {
            // We are REQUESTING payment FROM 'tx.destination' (The Client)
            // TO 'Younes Tsouli' (The Owner)
            return `${tx.destination},${tx.amount.toFixed(2)},${tx.currency},Attijariwafa Bank,007810000448500030594182,Younes Tsouli,ATTIJARI_MA`;
        });

        const content = header + rows.join('\n');
        
        fs.writeFileSync(filePath, content);
        
        console.log(`\n🏦 [BankGateway] Generated Payment Instructions: ${filePath}`);
        console.log(`   ⚠️  ACTION REQUIRED: Send these details to Clients for payment.`);

        return {
            status: 'INVOICES_GENERATED',
            filePath,
            batchId,
            instruction: 'Send IBAN to Clients'
        };
    }
}
