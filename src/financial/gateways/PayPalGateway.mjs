import paypal from '@paypal/payouts-sdk';
import fs from 'fs';
import path from 'path';

export class PayPalGateway {
    constructor() {
        this.clientId = process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = process.env.PAYPAL_SECRET;
        
        // Default to Sandbox unless strictly LIVE
        this.environment = process.env.SWARM_LIVE === 'true' 
            ? new paypal.core.LiveEnvironment(this.clientId, this.clientSecret)
            : new paypal.core.SandboxEnvironment(this.clientId, this.clientSecret);
        
        this.client = new paypal.core.PayPalHttpClient(this.environment);
        
        this.outputDir = path.join(process.cwd(), 'settlements', 'paypal');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async sendPayout(amount, currency, email, reference) {
        if (!this.clientId || !this.clientSecret) {
            return this.generateInstruction(amount, currency, email, 'MISSING_CREDENTIALS');
        }

        const request = new paypal.payouts.PayoutsPostRequest();
        request.requestBody({
            sender_batch_header: {
                sender_batch_id: `PAYPAL_${Date.now()}`,
                email_subject: "Autonomous Revenue Payout",
                email_message: `Settlement for ${reference}`
            },
            items: [{
                recipient_type: "EMAIL",
                amount: {
                    value: amount.toFixed(2),
                    currency: currency
                },
                receiver: email,
                note: reference,
                sender_item_id: `ITEM_${Date.now()}`
            }]
        });

        try {
            console.log(`   🅿️  [PayPalGateway] Sending ${amount} ${currency} to ${email}...`);
            const response = await this.client.execute(request);
            console.log(`      ✅ Payout Sent! Batch ID: ${response.result.batch_header.payout_batch_id}`);
            return { 
                status: 'IN_TRANSIT', 
                batchId: response.result.batch_header.payout_batch_id,
                details: response.result
            };
        } catch (error) {
            console.error(`      ❌ PayPal Execution Failed: ${error.message}`);
            // If it's an auth error, it might be due to credentials. Fallback.
            return this.generateInstruction(amount, currency, email, `EXECUTION_ERROR: ${error.message}`);
        }
    }

    generateInstruction(amount, currency, email, reason) {
        const timestamp = Date.now();
        const filename = `paypal_instruction_${timestamp}.json`;
        const filePath = path.join(this.outputDir, filename);
        
        const instruction = {
            type: 'PAYPAL_PAYOUT',
            amount,
            currency,
            recipient: email,
            reason,
            timestamp: new Date().toISOString(),
            status: 'WAITING_MANUAL_EXECUTION'
        };
        
        fs.writeFileSync(filePath, JSON.stringify(instruction, null, 2));
        console.log(`   ⚠️  PayPal Auto-Send Failed (${reason}). Generated Instruction: ${filePath}`);
        
        return {
            status: 'WAITING_MANUAL',
            filePath,
            instruction: 'Log in to PayPal and send manually'
        };
    }
}
