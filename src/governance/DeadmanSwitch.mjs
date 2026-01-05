import fs from 'fs'
import path from 'path'

export class DeadmanSwitch {
  constructor() {
    this.flagEnv = process.env.OWNER_DEADMAN_SWITCH === 'ON'
    this.flagFile = path.join(process.cwd(), 'owner.deadman')
    this.blocked = (process.env.OWNER_BLOCKED_CAPS || '').split(',').map(s => s.trim()).filter(Boolean)
  }
  engaged() {
    const fileEngaged = fs.existsSync(this.flagFile)
    return this.flagEnv || fileEngaged
  }
  check(task) {
    if (!this.engaged()) return { ok: true }
    const cap = task.requiredCapabilities?.[0]
    if (cap && this.blocked.includes(cap)) return { ok: false, reason: 'DEADMAN_SWITCH', capability: cap }
    return { ok: false, reason: 'DEADMAN_SWITCH' }
  }
}
