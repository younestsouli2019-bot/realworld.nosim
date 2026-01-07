import fs from 'fs';
import path from 'path';
import { PrivacyMasker } from '../../util/privacy-masker.mjs';
import { getPlatform } from '../../integrations/platform-registry.mjs';

export class InstructionGateway {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'settlements', 'platforms');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  async generate(provider, transactions, note = 'Platform Instruction') {
    const platform = getPlatform(provider);
    const id = String(provider || 'unknown').toLowerCase();
    const dir = path.join(this.baseDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `instruction_${Date.now()}.json`;
    const filePath = path.join(dir, filename);
    const masked = transactions.map(t => ({
      amount: Number(t.amount || 0),
      currency: t.currency || 'USD',
      masked_destination: PrivacyMasker.maskUnknown(t.destination || t.recipient_email || t.recipient_address || ''),
    }));
    const instruction = {
      provider: platform?.name || provider,
      id,
      note,
      created_at: new Date().toISOString(),
      status: 'WAITING_MANUAL_EXECUTION',
      masked_recipients: masked
    };
    fs.writeFileSync(filePath, JSON.stringify(instruction, null, 2));
    return { status: 'INSTRUCTIONS_READY', filePath, instruction };
  }

  async check(provider) {
    const id = String(provider || 'unknown').toLowerCase();
    const dir = path.join(process.cwd(), 'settlements', 'platforms', id);
    if (!fs.existsSync(dir)) return { status: 'not_found', provider: id };
    const files = fs.readdirSync(dir).filter(f => f.startsWith('instruction_'));
    return { status: files.length > 0 ? 'INSTRUCTIONS_READY' : 'not_found', provider: id, files };
  }
}

