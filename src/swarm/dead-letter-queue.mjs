
import { globalRecorder } from './flight-recorder.mjs';
import { buildBase44Client } from '../base44-client.mjs';
import { getRevenueConfigFromEnv } from '../base44-revenue.mjs';
import fs from 'fs';
import path from 'path';

// "Dead Letter" storage (file-based for simplicity, could be DB)
const DLQ_FILE = path.join(process.cwd(), 'swarm_dlq.json');

export class DeadLetterQueue {
  constructor() {
    this.queue = this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(DLQ_FILE)) return [];
      return JSON.parse(fs.readFileSync(DLQ_FILE, 'utf8'));
    } catch (e) {
      globalRecorder.error('Failed to load DLQ', { error: e.message });
      return [];
    }
  }

  _save() {
    try {
      fs.writeFileSync(DLQ_FILE, JSON.stringify(this.queue, null, 2));
    } catch (e) {
      globalRecorder.error('Failed to save DLQ', { error: e.message });
    }
  }

  push(item, reason, context = {}) {
    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      item,
      reason,
      context,
      status: 'new', // new, retrying, buried
      retryCount: 0
    };
    
    this.queue.push(entry);
    this._save();
    globalRecorder.warn(`Item moved to Dead Letter Queue`, { reason, itemId: item.id || 'unknown' });
  }

  async retryAll() {
    globalRecorder.info(`Retrying ${this.queue.length} DLQ items...`);
    // Implementation would depend on what "item" is (RevenueEvent, Payout, etc.)
    // For now, this is a placeholder for the concept.
    return { processed: 0, failed: 0 };
  }
  
  getStats() {
      return {
          size: this.queue.length,
          new: this.queue.filter(i => i.status === 'new').length,
          buried: this.queue.filter(i => i.status === 'buried').length
      };
  }
}

export const globalDLQ = new DeadLetterQueue();
