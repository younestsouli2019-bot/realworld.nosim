export class PayoneerGateway {
  async executeTransfer(transactions) {
    const prepared_at = new Date().toISOString();
    return { status: 'prepared', network: 'PAYONEER', prepared_at, transactions };
  }
}

