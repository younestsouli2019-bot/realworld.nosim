
export class BaseAdapter {
  constructor(config) {
    if (this.constructor === BaseAdapter) {
      throw new Error("Abstract classes can't be instantiated.");
    }
    this.config = config;
  }

  async transfer(options) {
    throw new Error("Method 'transfer()' must be implemented.");
  }

  async getBalance(address, token) {
    throw new Error("Method 'getBalance()' must be implemented.");
  }

  async getTransactionStatus(txHash) {
    throw new Error("Method 'getTransactionStatus()' must be implemented.");
  }
}
