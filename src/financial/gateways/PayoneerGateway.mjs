import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class PayoneerGateway {
    /**
     * @param {Object} config
     * Note: For API Credentials, contact Payoneer Support to enable "Mass Payouts API".
     * DO NOT register for "PSD2/Open Banking" (requires eIDAS).
     * Sandbox: https://github.com/Payoneer/Payoneer-API-Reference
     */
    constructor(config = {}) {
        this.programId = config.program_id || process.env.PAYONEER_PROGRAM_ID || '85538995';
        
        // Auto-Sanitize Credentials (Fix for RegEx errors)
        this.clientId = process.env.PAYONEER_CLIENT_ID 
            ? process.env.PAYONEER_CLIENT_ID.trim().replace(/['"]/g, '') 
            : undefined;
            
        this.clientSecret = process.env.PAYONEER_CLIENT_SECRET 
            ? process.env.PAYONEER_CLIENT_SECRET.trim().replace(/['"]/g, '') 
            : undefined;
        
        // Base URLs
        this.authUrl = process.env.SWARM_LIVE === 'true' 
            ? 'https://login.payoneer.com/api/v2/oauth2/token'
            : 'https://login.sandbox.payoneer.com/api/v2/oauth2/token';
            
        this.apiUrl = process.env.SWARM_LIVE === 'true'
            ? 'https://api.payoneer.com/v4/payouts'
            : 'https://api.sandbox.payoneer.com/v4/payouts';

        // Billing Service URL (For Receiving Money / Sending Invoices)
        this.billingUrl = process.env.SWARM_LIVE === 'true'
            ? 'https://api.payoneer.com/v4/billing-service/payment-requests'
            : 'https://api.sandbox.payoneer.com/v4/billing-service/payment-requests';

        this.mode = process.env.PAYONEER_MODE || 'RECEIVE'; // Enforce RECEIVE Default

        this.outputDir = path.join(process.cwd(), 'settlements', 'payoneer');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Executes a Mass Payout via Payoneer API if credentials exist,
     * otherwise falls back to CSV generation.
     * @param {Array} transactions - List of { amount, currency, destination, reference }
     * @returns {Object} result - { status, filePath, batchId }
     */
    async executePayout(transactions) {
        if (this.clientId && this.clientSecret) {
            return await this.sendApiBatch(transactions);
        } else {
            console.log('   ⚠️  Payoneer API Credentials missing. Falling back to CSV export.');
            return await this.generateBatch(transactions);
        }
    }

    /**
     * Authenticates with Payoneer via OAuth2
     */
    async getAuthToken() {
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        
        try {
            const response = await fetch(this.authUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: 'grant_type=client_credentials&scope=read write'
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Auth Failed: ${response.status} ${err}`);
            }

            const data = await response.json();
            return data.access_token;
        } catch (e) {
            throw new Error(`Payoneer Auth Error: ${e.message}`);
        }
    }

    /**
     * Sends the batch via API
     */
    async sendApiBatch(transactions) {
        const batchId = `PAY_API_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        
        try {
            console.log(`   🔄 [PayoneerGateway] Authenticating...`);
            const token = await this.getAuthToken();
            
            // Construct Payload
            const payments = transactions.map((tx, idx) => ({
                client_reference_id: `${batchId}-${idx+1}`,
                payee_id: tx.destination, // Email or Payoneer ID
                amount: tx.amount,
                currency: tx.currency,
                description: tx.reference || 'Autonomous Settlement'
            }));

            const payload = {
                payments: payments
            };

            console.log(`   📤 [PayoneerGateway] Sending Payout Batch (${payments.length} items)...`);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Program-Id': this.programId
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API Error: ${response.status} ${err}`);
            }

            const result = await response.json();
            console.log(`      ✅ Payoneer API Success: Batch ${result.result_id || batchId} Accepted.`);
            
            return {
                status: 'IN_TRANSIT',
                batchId: result.result_id || batchId,
                details: result,
                mode: 'API'
            };

        } catch (e) {
            console.error(`      ❌ Payoneer API Failed: ${e.message}`);
            console.log('      ↩️  Reverting to CSV Backup...');
            return await this.generateBatch(transactions);
        }
    }

    /**
     * Sends a Batch of Payment Requests (Billing Service)
     */
    async sendBillingBatch(transactions) {
        const batchId = `BILL_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        
        try {
            console.log(`   🔄 [PayoneerGateway] Authenticating (Billing Mode)...`);
            const token = await this.getAuthToken();
            
            // Note: Payoneer Billing API processes requests one by one or via specific batch endpoint.
            // For simplicity, we loop here or assume a hypothetical batch endpoint.
            // Official API usually requires creating a "Payment Request".
            
            console.log(`   📨 [PayoneerGateway] Sending ${transactions.length} Payment Requests...`);
            
            const results = [];
            for (const tx of transactions) {
                const payload = {
                    payer_id: tx.destination, // The Client ID or Email we are billing
                    amount: tx.amount,
                    currency: tx.currency,
                    description: tx.reference || 'Service Payment Request',
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Due in 7 days
                };

                const response = await fetch(this.billingUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Program-Id': this.programId
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.text();
                    console.error(`      ❌ Request to ${tx.destination} Failed: ${err}`);
                    results.push({ status: 'FAILED', error: err });
                } else {
                    const data = await response.json();
                    console.log(`      ✅ Request Sent to ${tx.destination}: ID ${data.id}`);
                    results.push({ status: 'SENT', id: data.id });
                }
            }

            return {
                status: 'REQUESTS_SENT',
                batchId,
                results,
                mode: 'API_BILLING'
            };

        } catch (e) {
            console.error(`      ❌ Payoneer Billing API Failed: ${e.message}`);
            return await this.generateBillingBatch(transactions);
        }
    }

    /**
     * Generates a Batch Payment Request CSV (Backup for Billing)
     */
    async generateBillingBatch(transactions) {
        const batchId = `BILL_CSV_${Date.now()}`;
        const filename = `payoneer_billing_requests_${batchId}.csv`;
        const filePath = path.join(this.outputDir, filename);

        // Header for Bulk Payment Request CSV
        const header = "PayerEmail,PayerName,Amount,Currency,Description,DueDate\n";
        
        const rows = transactions.map((tx) => {
            return `${tx.destination},Client Name,${tx.amount.toFixed(2)},${tx.currency},${tx.reference || 'Service'},${new Date().toISOString().split('T')[0]}`;
        });

        fs.writeFileSync(filePath, header + rows.join('\n'));
        console.log(`\n📄 [PayoneerGateway] Generated Billing CSV: ${filePath}`);
        
        return { status: 'WAITING_UPLOAD', filePath, batchId };
    }

    /**
     * Generates a Mass Payout CSV for Payoneer (Backup Method)
     */
    async generateBatch(transactions) {
        const batchId = `PAY_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;
        const filename = `payoneer_payout_${batchId}.csv`;
        const filePath = path.join(this.outputDir, filename);

        // Header required by Payoneer Mass Payout (Generic CSV Format)
        const header = "PaymentID,PayeeID,Amount,Currency,Description\n";
        
        const rows = transactions.map((tx, index) => {
            const paymentId = `${batchId}-${index+1}`;
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
            instruction: 'Upload CSV to Payoneer',
            mode: 'CSV'
        };
    }
}
