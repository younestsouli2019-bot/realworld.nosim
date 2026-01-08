import '../load-env.mjs';
import dns from 'node:dns/promises';
import https from 'node:https';
import { SwarmMemory } from '../swarm/shared-memory.mjs';
import { globalRecorder } from '../swarm/flight-recorder.mjs';

function pingHttps(host, path = '/', timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.request(
      { host, path, method: 'GET', timeout: timeoutMs },
      (res) => resolve(res.statusCode >= 200 && res.statusCode < 500)
    );
    req.on('timeout', () => {
      try { req.destroy(); } catch {}
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export class NetworkGuard {
  constructor(opts = {}) {
    this.intervalMs = Number(opts.intervalMs ?? 30000) || 30000;
    this.targets = [
      { id: 'payoneer', host: 'www.payoneer.com', path: '/' },
      { id: 'paypal', host: 'api.paypal.com', path: '/' },
      { id: 'paypal_web', host: 'www.paypal.com', path: '/' }
    ];
    const base44Host = (process.env.BASE44_API_HOST || '').trim();
    if (base44Host) this.targets.push({ id: 'base44', host: base44Host, path: '/' });
    this.running = false;
    this.memory = new SwarmMemory();
  }

  async checkTarget(t) {
    try {
      const dnsOk = await dns.lookup(t.host).then(() => true).catch(() => false);
      const httpsOk = dnsOk ? await pingHttps(t.host, t.path) : false;
      return { id: t.id, host: t.host, dnsOk, httpsOk };
    } catch {
      return { id: t.id, host: t.host, dnsOk: false, httpsOk: false };
    }
  }

  async runOnce() {
    const results = [];
    for (const t of this.targets) {
      const r = await this.checkTarget(t);
      results.push(r);
    }
    const summary = {
      ts: new Date().toISOString(),
      results,
      degraded: results.filter(r => !r.dnsOk || !r.httpsOk).map(r => r.id)
    };
    await this.memory.update('network-status', summary, 'network-guard', 'poll');
    if (summary.degraded.length > 0) {
      await this.memory.broadcastAlert(`Network degraded: ${summary.degraded.join(', ')}`, 'network-guard');
      globalRecorder.warn('Network degraded', { degraded: summary.degraded });
    } else {
      globalRecorder.info('Network healthy');
    }
    return summary;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.runOnce();
    const tick = async () => {
      if (!this.running) return;
      try { await this.runOnce(); } catch {}
      setTimeout(tick, this.intervalMs);
    };
    setTimeout(tick, this.intervalMs);
  }

  stop() {
    this.running = false;
  }
}
