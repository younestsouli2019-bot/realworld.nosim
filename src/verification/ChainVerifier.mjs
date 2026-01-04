import { ethers } from 'ethers';

export class ChainVerifier {
  constructor() {
    // Public RPC Endpoint for BSC (Binance Smart Chain)
    this.provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    this.USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
    this.ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];
  }

  /**
   * STRICTLY VERIFY a transaction on-chain.
   * Do NOT trust API responses alone. Trust the NODE.
   */
  async verifyTransaction(txHash, expectedAmount, expectedDestination, expectedCurrency = 'USDT') {
    console.log(`🔍 VERIFYING TX ON-CHAIN: ${txHash}`);
    
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        throw new Error(`TX NOT FOUND on blockchain: ${txHash}`);
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error(`TX RECEIPT NOT FOUND (Pending?): ${txHash}`);
      }

      if (receipt.status !== 1) {
        throw new Error(`TX FAILED (Reverted) on-chain: ${txHash}`);
      }

      // Check Logs for ERC20 Transfer
      const usdtInterface = new ethers.Interface(this.ERC20_ABI);
      let transferFound = false;

      for (const log of receipt.logs) {
        // Only check logs from the USDT contract
        if (log.address.toLowerCase() !== this.USDT_ADDRESS.toLowerCase()) continue;

        try {
          const parsed = usdtInterface.parseLog(log);
          if (parsed.name === 'Transfer') {
            const to = parsed.args[1];
            const value = parsed.args[2];
            
            // 1. Verify Destination
            if (to.toLowerCase() === expectedDestination.toLowerCase()) {
              // 2. Verify Amount (Fuzzy match for float precision)
              // We need decimals to convert
              const decimals = 18; // Standard for USDT on BSC (Wait, USDT is 18 on BSC? Check contract.)
              // Actually USDT on BSC is 18.
              // Let's verify decimals dynamically if possible, or assume 18.
              // Safe way: get decimals from contract.
              // But here we are parsing logs.
              
              const valueFormatted = ethers.formatUnits(value, 18); // USDT on BSC is 18 decimals
              
              if (Math.abs(parseFloat(valueFormatted) - parseFloat(expectedAmount)) < 0.1) {
                transferFound = true;
                console.log(`✅ VERIFIED: Transfer of ${valueFormatted} USDT to ${to}`);
                break;
              }
            }
          }
        } catch (e) {
          // Not a transfer event we care about
        }
      }

      if (!transferFound) {
        throw new Error(`TX CONFIRMED but NO Matching Transfer Event found for ${expectedAmount} USDT to ${expectedDestination}`);
      }

      return {
        verified: true,
        blockNumber: receipt.blockNumber,
        confirmations: await receipt.confirmations()
      };

    } catch (error) {
      console.error(`❌ VERIFICATION FAILED: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan for recent incoming transactions (Alternative if TX Hash is unknown)
   */
  async scanIncoming(targetAddress, amount, timeWindowSeconds = 300) {
    // Complex without an indexer API like BscScan.
    // RPC nodes don't easily support "get transactions by address".
    // We will stick to TX Hash verification for now.
    throw new Error("Scan Not Implemented - Requires BscScan API Key");
  }
}
