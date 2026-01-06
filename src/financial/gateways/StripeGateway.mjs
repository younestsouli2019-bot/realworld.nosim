export class StripeGateway {
  async executeTransfer(transactions) {
    const prepared_at = new Date().toISOString();
    return { status: 'prepared', network: 'STRIPE', prepared_at, transactions };
  }
}

