
export class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.version = 1;
    this.subscribers = new Map(); // agentId -> callback
    
    // Initialize with default config
    this.configs.set(1, {
        version: 1,
        updatedBy: 'system',
        updatedAt: Date.now(),
        updateReason: 'Initial config'
    });
  }
  
  getCurrentConfig() {
      return this.configs.get(this.version);
  }

  async updateConfig(updates, agentId, reason) {
    // Create new version
    const newConfig = { ...this.getCurrentConfig(), ...updates };
    newConfig.version = this.version + 1;
    newConfig.updatedBy = agentId;
    newConfig.updatedAt = Date.now();
    newConfig.updateReason = reason;
    
    // Validate
    if (!this.validateConfig(newConfig)) {
      throw new Error('Config validation failed');
    }
    
    // Notify subscribers
    await this.notifySubscribers(newConfig);
    
    // Apply after successful notification
    this.configs.set(newConfig.version, newConfig);
    this.version = newConfig.version;
    
    return newConfig;
  }
  
  validateConfig(config) {
      // Basic validation
      return config && config.version > this.version;
  }

  subscribe(agentId, callback) {
      this.subscribers.set(agentId, callback);
  }

  notifySubscribers(newConfig) {
    const promises = [];
    
    for (const [agentId, callback] of this.subscribers) {
      promises.push(
        callback(newConfig).catch(err => {
          console.error(`Failed to update config for ${agentId}:`, err);
        })
      );
    }
    
    return Promise.all(promises);
  }
}
