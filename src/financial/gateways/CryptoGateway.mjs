export class CryptoGateway {
  async executeTransfer(transactions) {
    const network = process.env.CRYPTO_NETWORK || 'ERC20';
    const prepared_at = new Date().toISOString();
    return { status: 'prepared', network, prepared_at, transactions };
  }
}

