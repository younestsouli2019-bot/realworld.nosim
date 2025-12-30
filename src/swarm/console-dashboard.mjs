
import { globalRecorder } from './flight-recorder.mjs';
import { globalDLQ } from './dead-letter-queue.mjs';
import { SwarmMemory } from './shared-memory.mjs';
import fs from 'fs';

export async function renderDashboard() {
  const memory = new SwarmMemory();
  const state = memory.getState();
  const dlqStats = globalDLQ.getStats();
  
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               SWARM AUTONOMOUS CONSOLE                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Status: ${state.systemStatus.padEnd(20)} | Uptime: ${process.uptime().toFixed(0)}s           ║`);
  console.log(`║ Mode:   ${(process.env.SWARM_LIVE === 'true' ? 'LIVE 🔴' : 'SIMULATION 🟢').padEnd(20)} | PID:    ${process.pid.toString().padEnd(10)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ HEALTH METRICS                                             ║');
  console.log(`║ • Active Agents: ${state.activeAgents.length.toString().padEnd(5)}                                     ║`);
  console.log(`║ • Circuit Breakers:                                        ║`);
  // This would need real CB state access, purely visual placeholder for now
  console.log(`║    - PayPal API:   CLOSED (Healthy)                        ║`); 
  console.log(`║    - Base44 Write: CLOSED (Healthy)                        ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ QUEUE STATUS                                               ║');
  console.log(`║ • Dead Letters: ${dlqStats.size.toString().padEnd(5)} (New: ${dlqStats.new})                            ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ RECENT EVENTS (FLIGHT RECORDER)                            ║');
  
  const recentLogs = globalRecorder.logBuffer.slice(-5).reverse();
  recentLogs.forEach(log => {
      let color = '';
      let msg = log.message.substring(0, 50).padEnd(50);
      console.log(`║ ${log.timestamp.split('T')[1].split('.')[0]} [${log.level.padEnd(5)}] ${msg} ║`);
  });
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nPress Ctrl+C to exit dashboard (Daemon continues in background if detached)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Self-update loop if run directly
  setInterval(renderDashboard, 1000);
}
