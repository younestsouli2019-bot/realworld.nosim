import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export class CryptoGateway {
    constructor() {
        this.privateKey = process.env.WALLET_PRIVATE_KEY;
        // Default to BSC for low fees, fallback to ETH
        this.rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/'; 
        this.outputDir = path.join(process.cwd(), 'settlements', 'crypto');
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        
        // Minimal ERC20 ABI
        this.erc20Abi = [
            "function transfer(address to, uint256 amount) returns (bool)",
            "function decimals() view returns (uint8)"
        ];
    }

    async sendTransaction(amount, currency, destination) {
        if (!this.privateKey) {
            return this.generateInstruction(amount, currency, destination, 'MISSING_PRIVATE_KEY');
        }

        try {
            console.log(`   🔗 [CryptoGateway] Initiating ${amount} ${currency} transfer to ${destination}...`);
            const provider = new ethers.JsonRpcProvider(this.rpcUrl);
            const wallet = new ethers.Wallet(this.privateKey, provider);
            
            // Resolve Token Address (Hardcoded for Major Tokens on BSC)
            const tokenAddress = this.getTokenAddress(currency);
            
            if (!tokenAddress) {
                // Native Transfer (BNB/ETH)
                const tx = await wallet.sendTransaction({
                    to: destination,
                    value: ethers.parseEther(amount.toString())
                });
                console.log(`      ✅ Transaction Sent: ${tx.hash}`);
                return { status: 'IN_TRANSIT', txHash: tx.hash, amount, currency, destination };
            } else {
                // Token Transfer
                const contract = new ethers.Contract(tokenAddress, this.erc20Abi, wallet);
                const decimals = await contract.decimals();
                const amountInWei = ethers.parseUnits(amount.toString(), decimals);
                
                const tx = await contract.transfer(destination, amountInWei);
                console.log(`      ✅ Token Transfer Sent: ${tx.hash}`);
                return { status: 'IN_TRANSIT', txHash: tx.hash, amount, currency, destination };
            }
            
        } catch (error) {
            console.error(`      ❌ Crypto Execution Failed: ${error.message}`);
            return this.generateInstruction(amount, currency, destination, `EXECUTION_ERROR: ${error.message}`);
        }
    }

    getTokenAddress(currency) {
        // BSC Addresses
        const map = {
            'USDT': '0x55d398326f99059fF775485246999027B3197955',
            'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            'DAI': '0x1AF3F329e8BE154074D8769D1FF4aE00844215dA'
        };
        return map[currency] || null; // Null implies Native (BNB)
    }

    generateInstruction(amount, currency, destination, reason) {
        const timestamp = Date.now();
        const filename = `crypto_instruction_${timestamp}.json`;
        const filePath = path.join(this.outputDir, filename);
        
        const instruction = {
            type: 'CRYPTO_TRANSFER',
            amount,
            currency,
            destination,
            network: 'BSC', // Assumption
            reason,
            timestamp: new Date().toISOString(),
            status: 'WAITING_MANUAL_EXECUTION'
        };
        
        fs.writeFileSync(filePath, JSON.stringify(instruction, null, 2));
        console.log(`   ⚠️  Crypto Auto-Send Failed (${reason}). Generated Instruction: ${filePath}`);
        
        return {
            status: 'WAITING_MANUAL',
            filePath,
            instruction: 'Execute manually via Trust Wallet'
        };
    }
}
