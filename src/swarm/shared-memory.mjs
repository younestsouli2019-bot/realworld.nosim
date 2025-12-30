
class CRDTMap {
  constructor() {
    this.data = new Map();
    this.tombstones = new Map();
  }

  get(key) {
    return this.data.get(key);
  }

  set(key, value, timestamp = Date.now()) {
    const existing = this.data.get(key);
    // Simple LWW (Last-Write-Wins) strategy
    // In a real CRDT, we would track vector clocks or more complex state
    this.data.set(key, value);
  }

  delete(key, timestamp = Date.now()) {
    this.data.delete(key);
    this.tombstones.set(key, timestamp);
  }
}

export class SwarmMemory {
  constructor() {
    this.state = new CRDTMap(); // Conflict-free replicated data type
    this.version = 0;
    this.observers = [];
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
    // For now, we simulate agreement as we are running in a single process
    const agreementCount = responses.agree.length;
    const required = Math.ceil(this.observers.length / 2);

    if (agreementCount >= required || this.observers.length === 0) {
      this.state.set(key, value);
      this.version++;
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
      console.log(`[SwarmMemory] Update applied: ${proposal.key} = ${JSON.stringify(proposal.value)} by ${proposal.agentId}`);
  }

  addObserver(observer) {
      this.observers.push(observer);
  }
}
