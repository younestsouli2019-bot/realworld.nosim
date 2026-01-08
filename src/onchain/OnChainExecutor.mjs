
import { EVMAdapter } from './adapters/EVMAdapter.mjs';
import { TransactionMonitor } from './TransactionMonitor.mjs';

const ADAPTERS = {
  EVM: EVMAdapter
};

export class OnChainExecutor {
  constructor(config = {}) {
    this.adapters = {};
    this.defaultChain = config.defaultChain || 'BSC';
    this.monitor = new TransactionMonitor(this);
    this.initAdapters(config.chains);
  }

  initAdapters(chainConfigs) {
    if (!chainConfigs) {
      this.adapters['BSC'] = new EVMAdapter({ 
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        privateKey: process.env.WALLET_PRIVATE_KEY 
      });
      this.adapters['ETH'] = new EVMAdapter({ 
        rpcUrl: process.env.ETH_RPC_URL,
        privateKey: process.env.WALLET_PRIVATE_KEY 
      });
      return;
    }

    for (const [chain, config] of Object.entries(chainConfigs)) {
      const adapterType = config.type || 'EVM';
      const AdapterClass = ADAPTERS[adapterType];
      if (AdapterClass) {
        this.adapters[chain] = new AdapterClass({
          rpcUrl: config.rpcUrl,
          privateKey: process.env.WALLET_PRIVATE_KEY
        });
      }
    }
  }

  getAdapter(chain) {
    const adapter = this.adapters[chain || this.defaultChain];
    if (!adapter) {
      throw new Error(`No adapter found for chain: ${chain || this.defaultChain}`);
    }
    return adapter;
  }

  async sendTransaction(transaction) {
    const { chain, to, value, token, currency } = transaction;
    const adapter = this.getAdapter(chain);
    const result = await adapter.transfer({ to, value, token, currency });

    if (result.txHash) {
      this.monitor.monitorTransaction(result.txHash, chain);
    }

    return result;
  }

  async getBalance(address, chain, token) {
    const adapter = this.getAdapter(chain);
    return adapter.getBalance(address, token);
  }

  async getTransactionStatus(txHash, chain) {
    const adapter = this.getAdapter(chain);
    return adapter.getTransactionStatus(txHash);
  }
}
