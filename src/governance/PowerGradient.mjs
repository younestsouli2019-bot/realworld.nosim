export class PowerGradient {
  score(task) {
    const impact = task.meta?.externalizedCost ? 1 : 0
    const consent = task.meta?.hasConsent ? 0 : 1
    const exit = task.meta?.hasExit ? 0 : 1
    const s = impact + consent + exit
    return s
  }
  check(task, threshold = 2) {
    const s = this.score(task)
    return s >= threshold ? { ok: false, reason: 'POWER_GRADIENT_HIGH', score: s } : { ok: true, score: s }
  }
}
