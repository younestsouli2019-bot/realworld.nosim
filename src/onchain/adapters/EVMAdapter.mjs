
import { ethers } from 'ethers';
import { BaseAdapter } from './BaseAdapter.mjs';

const ERC20_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const TOKEN_ADDRESSES = {
  USDT_BSC: '0x55d398326f99059fF775485246999027B3197955',
  USDT_ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
};

export class EVMAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    if (!config.rpcUrl || !config.privateKey) {
      throw new Error('EVMAdapter requires rpcUrl and privateKey');
    }
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
  }

  async transfer({ to, value, token, currency }) {
    if (!token && currency) {
      token = this.getTokenAddress(currency);
    }

    if (!token) {
      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(value.toString())
      });
      return { txHash: tx.hash };
    }

    const tokenContract = new ethers.Contract(token, ERC20_ABI, this.wallet);
    const decimals = await tokenContract.decimals();
    const amount = ethers.parseUnits(value.toString(), decimals);
    
    const tx = await tokenContract.transfer(to, amount);
    return { txHash: tx.hash };
  }

  async getBalance(address, token) {
    if (!token) {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    }

    const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
    const balance = await tokenContract.balanceOf(address);
    const decimals = await tokenContract.decimals();
    return ethers.formatUnits(balance, decimals);
  }

  async getTransactionStatus(txHash) {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { status: 'PENDING' };
    }
    if (receipt.status === 1) {
      return { status: 'CONFIRMED', confirmations: await receipt.confirmations() };
    }
    return { status: 'FAILED' };
  }

  async getTransactionReceipt(txHash) {
    return this.provider.getTransactionReceipt(txHash);
  }

  getTokenAddress(currency) {
    const upperCurrency = currency.toUpperCase();
    if (this.config.rpcUrl.includes('bsc')) {
      if (upperCurrency === 'USDT') return TOKEN_ADDRESSES.USDT_BSC;
    }
    if (this.config.rpcUrl.includes('eth')) {
      if (upperCurrency === 'USDT') return TOKEN_ADDRESSES.USDT_ETH;
    }
    return null;
  }
}
