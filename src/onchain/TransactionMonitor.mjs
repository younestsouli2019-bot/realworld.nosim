export class TransactionMonitor {
  constructor(onChainExecutor) {
    this.onChainExecutor = onChainExecutor;
    this.pendingTransactions = new Map();
    this.monitoringInterval = setInterval(() => this.checkPendingTransactions(), 15000);
  }

  monitorTransaction(txHash, chain) {
    console.log(`[TransactionMonitor] Monitoring transaction ${txHash} on ${chain}`);
    this.pendingTransactions.set(txHash, { chain, startTime: Date.now() });
  }

  async checkPendingTransactions() {
    if (this.pendingTransactions.size === 0) {
      return;
    }

    console.log(`[TransactionMonitor] Checking status of ${this.pendingTransactions.size} pending transaction(s)...`);

    for (const [txHash, { chain }] of this.pendingTransactions.entries()) {
      try {
        const adapter = this.onChainExecutor.getAdapter(chain);
        const receipt = await adapter.getTransactionReceipt(txHash);

        if (receipt && receipt.status === 1) {
          console.log(`[TransactionMonitor] Transaction ${txHash} confirmed on ${chain}`);
          this.pendingTransactions.delete(txHash);
        } else if (receipt && receipt.status === 0) {
          console.error(`[TransactionMonitor] Transaction ${txHash} failed on ${chain}`);
          this.pendingTransactions.delete(txHash);
        }
      } catch (error) {
        console.error(`[TransactionMonitor] Error checking transaction ${txHash} on ${chain}:`, error);
      }
    }
  }

  stopMonitoring() {
    clearInterval(this.monitoringInterval);
  }
}
