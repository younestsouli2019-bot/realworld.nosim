import fs from 'fs';
import path from 'path';

class CRDTMap {
  constructor(initialData = []) {
    this.data = new Map(initialData);
    this.tombstones = new Map();
  }

  get(key) {
    return this.data.get(key);
  }

  set(key, value, timestamp = Date.now()) {
    // Simple LWW (Last-Write-Wins) strategy
    this.data.set(key, value);
  }

  delete(key, timestamp = Date.now()) {
    this.data.delete(key);
    this.tombstones.set(key, timestamp);
  }

  toJSON() {
    return Array.from(this.data.entries());
  }
}

export class SwarmMemory {
  constructor(options = {}) {
    this.storePath = options.storePath || path.join(process.cwd(), 'data', 'swarm-memory.json');
    this.state = new CRDTMap(this.loadState());
    this.version = 0;
    this.observers = [];
  }

  loadState() {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      }
    } catch (e) {
      console.error('[SwarmMemory] Failed to load state:', e);
    }
    return [];
  }

  saveState() {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(this.state.toJSON(), null, 2));
    } catch (e) {
      console.error('[SwarmMemory] Failed to save state:', e);
    }
  }
  
  async update(key, value, agentId, reason) {
    // Propose update
    const proposal = {
      key,
      value,
      agentId,
      reason,
      timestamp: Date.now(),
      previousValue: this.state.get(key)
    };
    
    // Notify other agents
    const responses = await this.broadcastProposal(proposal);
    
    // Require at least 50% agreement for non-critical updates
    const agreementCount = responses.agree.length;
    const required = Math.ceil(this.observers.length / 2);

    if (agreementCount >= required || this.observers.length === 0) {
      this.state.set(key, value);
      this.version++;
      this.saveState(); // Persist immediately
      this.logUpdate(proposal);
      return true;
    }
    
    return false; // No consensus
  }

  async broadcastProposal(proposal) {
    // In a real distributed system, this would send network requests
    // Here we just ask registered observers
    const agree = [];
    const reject = [];

    for (const observer of this.observers) {
        try {
            const result = await observer.onProposal(proposal);
            if (result) agree.push(observer.id);
            else reject.push(observer.id);
        } catch (e) {
            reject.push(observer.id);
        }
    }

    return { agree, reject };
  }

  logUpdate(proposal) {
      // console.log(`[SwarmMemory] Update applied: ${proposal.key} = ${JSON.stringify(proposal.value)} by ${proposal.agentId}`);
  }

  addObserver(observer) {
      this.observers.push(observer);
  }
  
  get(key) {
      return this.state.get(key);
  }
}
