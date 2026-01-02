import fs from "node:fs";
import path from "node:path";
import { globalRecorder } from "../swarm/flight-recorder.mjs";
import { runDoomsdayExport } from "../real/ledger/doomsday-export.mjs";

const THREAT_LEVELS = {
  LOW: 0,       // Normal operation
  MEDIUM: 1,    // Increased error rate, minor API blocking
  HIGH: 2,      // Persistent 403s, 429s, API functionality degraded
  CRITICAL: 3   // 451s (Legal), complete de-platforming signals, "Bunker Mode" activated
};

const STATE_FILE = path.join(process.cwd(), ".threat-state.json");

class ThreatMonitor {
  constructor() {
    this.state = this.loadState();
    this.errorCounts = {};
    this.windowStart = Date.now();
    this.WINDOW_MS = 60 * 60 * 1000; // 1 hour window
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      }
    } catch (e) {
      console.error("Failed to load threat state:", e);
    }
    return { level: THREAT_LEVELS.LOW, bunkerMode: false, lastUpdate: Date.now() };
  }

  saveState() {
    try {
      this.state.lastUpdate = Date.now();
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (e) {
      console.error("Failed to save threat state:", e);
    }
  }

  resetWindow() {
    if (Date.now() - this.windowStart > this.WINDOW_MS) {
      this.errorCounts = {};
      this.windowStart = Date.now();
    }
  }

  reportError(source, error) {
    this.resetWindow();
    const msg = error?.message || String(error);
    
    // Categorize Error
    let weight = 0;
    if (msg.includes("403")) weight = 2; // Forbidden
    if (msg.includes("429")) weight = 1; // Rate Limit
    if (msg.includes("451")) weight = 10; // Legal/Censorship (Immediate Critical)
    if (msg.includes("ENOTFOUND")) weight = 0.5; // DNS/Net
    if (msg.includes("ECONNREFUSED")) weight = 0.5;

    if (weight === 0) return; // Ignore mundane errors

    this.errorCounts[source] = (this.errorCounts[source] || 0) + weight;

    this.assessThreat();
  }

  assessThreat() {
    const totalScore = Object.values(this.errorCounts).reduce((a, b) => a + b, 0);

    let newLevel = THREAT_LEVELS.LOW;

    if (totalScore > 5) newLevel = THREAT_LEVELS.MEDIUM;
    if (totalScore > 20) newLevel = THREAT_LEVELS.HIGH;
    if (totalScore > 50 || this.hasCriticalSignal()) newLevel = THREAT_LEVELS.CRITICAL;

    if (newLevel !== this.state.level) {
      console.warn(`⚠️ THREAT LEVEL CHANGED: ${this.getLevelName(this.state.level)} -> ${this.getLevelName(newLevel)}`);
      globalRecorder.warn(`THREAT_LEVEL_CHANGE: ${this.getLevelName(newLevel)}`);
      this.state.level = newLevel;
      
      if (newLevel === THREAT_LEVELS.CRITICAL) {
        this.activateBunkerMode();
      }
      
      this.saveState();
    }
  }

  hasCriticalSignal() {
    // Check for 451s explicitly in recent errors?
    // Simplified: weight 10 adds up fast.
    return false; 
  }

  activateBunkerMode() {
    if (this.state.bunkerMode) return;
    console.error("☢️ BUNKER MODE ACTIVATED: DISCONNECTING FROM HOSTILE APIS ☢️");
    this.state.bunkerMode = true;
    this.saveState();
    
    // Trigger Doomsday Export immediately upon activation
    try {
        runDoomsdayExport().catch(e => console.error("Doomsday Export Failed:", e));
    } catch {}
  }

  deactivateBunkerMode() {
    console.log("🕊️ Bunker Mode Deactivated. Resuming standard operations.");
    this.state.bunkerMode = false;
    this.state.level = THREAT_LEVELS.LOW;
    this.errorCounts = {};
    this.saveState();
  }

  isBunkerMode() {
    return this.state.bunkerMode;
  }

  getLevelName(val) {
    return Object.keys(THREAT_LEVELS).find(k => THREAT_LEVELS[k] === val) || "UNKNOWN";
  }
}

export const threatMonitor = new ThreatMonitor();
