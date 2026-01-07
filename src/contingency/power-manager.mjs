import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

export class PowerRedundancyManager {
  constructor(opts = {}) {
    this.switchTimeoutMs = opts.switchTimeoutMs || 30000
    this.minRuntimeMinutes = opts.minRuntimeMinutes || 60
    this.onAlert = typeof opts.onAlert === 'function' ? opts.onAlert : () => {}
    this.state = {
      primary: 'unknown',
      backupAvailable: true,
      failoverActive: false,
      lastOutageAt: null,
      lastFailoverAt: null,
      lastRestoreAt: null
    }
    this.active = false
  }
  start() {
    this.active = true
    this.loop()
  }
  stop() {
    this.active = false
  }
  async loop() {
    if (!this.active) return
    try {
      const status = this.readStatus()
      if (status === 'outage') {
        if (!this.state.failoverActive) {
          this.state.lastOutageAt = Date.now()
          this.activateFailover()
        }
      } else if (status === 'ok') {
        if (this.state.failoverActive) {
          this.state.failoverActive = false
          this.state.lastRestoreAt = Date.now()
          this.onAlert('POWER_RESTORED', 'Primary power restored')
          this.recordEvent({ type: 'restore', at: this.state.lastRestoreAt })
        }
        this.state.primary = 'ok'
      }
    } catch (e) {}
    setTimeout(() => this.loop(), 5000)
  }
  readStatus() {
    const p = path.join(process.cwd(), 'owner.requests', 'power_status.json')
    if (fs.existsSync(p)) {
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'))
        return j.status || 'unknown'
      } catch {}
    }
    try {
      const out = execSync('powershell -Command "(Get-WmiObject -Class Win32_Battery | Select-Object -ExpandProperty BatteryStatus)"', { stdio: 'pipe' }).toString().trim()
      if (out.length) return 'ok'
    } catch {}
    return 'ok'
  }
  activateFailover() {
    const now = Date.now()
    this.state.failoverActive = true
    this.state.lastFailoverAt = now
    const diff = this.state.lastOutageAt ? now - this.state.lastOutageAt : 0
    if (diff > this.switchTimeoutMs) {
      this.onAlert('POWER_FAILOVER_DELAY', `Failover exceeded ${this.switchTimeoutMs}ms`)
    } else {
      this.onAlert('POWER_FAILOVER_ACTIVE', `Failover in ${diff}ms`)
    }
    this.recordEvent({ type: 'failover', at: now, delay_ms: diff })
  }
  recordEvent(evt) {
    const dir = path.join(process.cwd(), 'exports', 'reports')
    fs.mkdirSync(dir, { recursive: true })
    const f = path.join(dir, 'power_failover_events.json')
    const line = JSON.stringify({ ...evt, runtime_min: this.minRuntimeMinutes })
    fs.appendFileSync(f, line + '\n')
  }
  simulateOutage() {
    const p = path.join(process.cwd(), 'owner.requests', 'power_status.json')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ status: 'outage' }))
  }
  simulateRestore() {
    const p = path.join(process.cwd(), 'owner.requests', 'power_status.json')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ status: 'ok' }))
  }
  getStatus() {
    return { ...this.state }
  }
}
