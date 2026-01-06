export class BankWireGateway {
  async executeTransfer(transactions) {
    const prepared_at = new Date().toISOString();
    return { status: 'prepared', network: 'BANK_WIRE', prepared_at, transactions };
  }
}

