export class DomainAutonomy {
  constructor(tiers = {}) {
    const d = tiers
    this.tiers = {
      finance: d.finance ?? 2,
      marketing: d.marketing ?? 2,
      research: d.research ?? 2,
      outreach: d.outreach ?? 1
    }
  }
  ceiling(domain) {
    return this.tiers[domain] ?? 1
  }
  check(task) {
    const domain = task.domain || 'general'
    const tier = task.autonomyTier ?? 1
    const ceiling = this.ceiling(domain)
    if (tier > ceiling) return { ok: false, reason: 'AUTONOMY_CEILING_EXCEEDED', domain, tier, ceiling }
    return { ok: true, domain, tier, ceiling }
  }
}
