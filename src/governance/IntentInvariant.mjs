export class IntentInvariant {
  constructor(config = {}) {
    this.billingOnly = config.billingOnly ?? (process.env.RECEIVE_ONLY === 'true')
    this.noExtraction = config.noExtraction ?? true
    this.noDeception = config.noDeception ?? true
  }
  check(task) {
    if (this.billingOnly && task.action === 'payout') return { ok: false, reason: 'INTENT_BILLING_ONLY' }
    if (this.noExtraction && task.meta?.extract) return { ok: false, reason: 'INTENT_NO_EXTRACTION' }
    if (this.noDeception && task.meta?.deception) return { ok: false, reason: 'INTENT_NO_DECEPTION' }
    return { ok: true }
  }
}
