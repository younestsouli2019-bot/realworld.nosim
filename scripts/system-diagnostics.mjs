import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'

function human(bytes) {
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

function checkDisk() {
  try {
    const drives = os.platform() === 'win32' ? ['C:\\'] : ['/']
    const res = drives.map(d => {
      try {
        // Approximate using temp file write speed and free memory as proxy
        const tmp = fs.mkdtempSync(`${os.tmpdir()}${os.platform()==='win32'?'\\':'/'}diag-`)
        const start = Date.now()
        fs.writeFileSync(tmp + (os.platform()==='win32'?'\\':'/') + 'probe.bin', Buffer.alloc(1024 * 1024))
        const durationMs = Date.now() - start
        fs.rmSync(tmp, { recursive: true, force: true })
        return { drive: d, write_probe_ms: durationMs }
      } catch (e) {
        return { drive: d, error: e.message }
      }
    })
    return { ok: true, probes: res }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

function checkNetwork() {
  try {
    const start = Date.now()
    execSync(os.platform()==='win32' ? 'ping -n 1 8.8.8.8' : 'ping -c 1 8.8.8.8', { stdio: 'ignore' })
    const durationMs = Date.now() - start
    return { ok: true, latency_ms: durationMs }
  } catch (e) {
    return { ok: false, error: 'network_unreachable' }
  }
}

function checkFileIntegrity() {
  try {
    const critical = [
      'data/autonomous/ledger/batch_BATCH_PAYONEER_X_1767529200.json',
      'exports/receipts'
    ]
    const issues = []
    for (const p of critical) {
      if (!fs.existsSync(p)) issues.push({ path: p, issue: 'missing' })
    }
    return { ok: issues.length === 0, issues }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

function main() {
  const report = {
    ts: new Date().toISOString(),
    disk: checkDisk(),
    network: checkNetwork(),
    files: checkFileIntegrity(),
    mem_free: human(os.freemem()),
    mem_total: human(os.totalmem())
  }
  console.log(JSON.stringify(report))
}

main()
