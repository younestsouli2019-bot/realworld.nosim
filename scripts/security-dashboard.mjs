import '../src/load-env.mjs';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { NetworkGuard } from '../src/security/NetworkGuard.mjs';
import { threatMonitor } from '../src/security/threat-monitor.mjs';
import { ThreatMitigation } from '../src/security/ThreatMitigation.mjs';
import { SwarmMemory } from '../src/swarm/shared-memory.mjs';

const app = express();
const PORT = Number(process.env.SECURITY_DASHBOARD_PORT) || 3001;
const memory = new SwarmMemory();
const mitigation = new ThreatMitigation();
const guard = new NetworkGuard({ intervalMs: Number(process.env.NETWORK_GUARD_INTERVAL_MS) || 30000 });

app.use(express.json());

function readThreatState() {
  const p = path.join(process.cwd(), '.threat-state.json');
  try { 
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return { level: 0, bunkerMode: false, lastUpdate: Date.now() };
}

app.get('/api/network-status', async (_req, res) => {
  const status = memory.get('network-status') || { ts: new Date().toISOString(), results: [], degraded: [] };
  res.json(status);
});

app.get('/api/threat-state', (_req, res) => {
  res.json(readThreatState());
});

app.get('/api/mitigation/status', (_req, res) => {
  res.json(mitigation.getMitigationStatus());
});

app.post('/api/actions/check-now', async (_req, res) => {
  const summary = await guard.runOnce();
  res.json(summary);
});

app.post('/api/actions/bunker', (_req, res) => {
  const { enable } = _req.body || {};
  if (enable === true) {
    threatMonitor.activateBunkerMode();
  } else {
    threatMonitor.deactivateBunkerMode();
  }
  res.json(readThreatState());
});

app.post('/api/actions/mitigate', async (_req, res) => {
  const { agentId = 'network-guard', threatType = 'NETWORK_DEGRADED' } = _req.body || {};
  const result = await mitigation.deployMitigation(agentId, threatType);
  res.json(result);
});

app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Security Dashboard</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
        .ok { color: #0a0; }
        .bad { color: #a00; }
        button { padding: 8px 12px; margin-right: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Security Dashboard</h1>
      <div>
        <button onclick="checkNow()">Check Network Now</button>
        <button onclick="setBunker(true)">Enable Bunker Mode</button>
        <button onclick="setBunker(false)">Disable Bunker Mode</button>
        <button onclick="mitigate()">Deploy Mitigation</button>
      </div>
      <div class="grid">
        <div class="card">
          <h2>Network Status</h2>
          <div id="net-ts"></div>
          <table id="net-table">
            <thead><tr><th>Target</th><th>DNS</th><th>HTTPS</th></tr></thead>
            <tbody></tbody>
          </table>
          <div id="net-degraded"></div>
        </div>
        <div class="card">
          <h2>Threat State</h2>
          <pre id="threat-state"></pre>
          <h3>Mitigation</h3>
          <pre id="mitigation"></pre>
        </div>
      </div>
      <script>
        async function refresh() {
          const ns = await fetch('/api/network-status').then(r => r.json());
          document.getElementById('net-ts').textContent = 'Timestamp: ' + ns.ts;
          const tbody = document.querySelector('#net-table tbody');
          tbody.innerHTML = '';
          ns.results.forEach(r => {
            const tr = document.createElement('tr');
            const dns = r.dnsOk ? '<span class="ok">OK</span>' : '<span class="bad">FAIL</span>';
            const https = r.httpsOk ? '<span class="ok">OK</span>' : '<span class="bad">FAIL</span>';
            tr.innerHTML = '<td>' + r.id + '</td><td>' + dns + '</td><td>' + https + '</td>';
            tbody.appendChild(tr);
          });
          document.getElementById('net-degraded').textContent = 'Degraded: ' + (ns.degraded.join(', ') || 'none');
          
          const ts = await fetch('/api/threat-state').then(r => r.json());
          document.getElementById('threat-state').textContent = JSON.stringify(ts, null, 2);
          
          const ms = await fetch('/api/mitigation/status').then(r => r.json());
          document.getElementById('mitigation').textContent = JSON.stringify(ms, null, 2);
        }
        async function checkNow() { await fetch('/api/actions/check-now', { method: 'POST' }); await refresh(); }
        async function setBunker(enable) { await fetch('/api/actions/bunker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enable }) }); await refresh(); }
        async function mitigate() { await fetch('/api/actions/mitigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: 'network-guard', threatType: 'NETWORK_DEGRADED' }) }); await refresh(); }
        refresh();
        setInterval(refresh, 5000);
      </script>
    </body>
    </html>
  `);
});

async function start() {
  await guard.start();
  app.listen(PORT, () => {
    console.log('🔐 Security Dashboard running at http://localhost:' + PORT + '/');
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(err => {
    console.error('Failed to start Security Dashboard:', err);
    process.exit(1);
  });
}
