export class TransparencyCost {
  compute(task) {
    const text = String(task.payload?.text || '')
    const link = String(task.payload?.link || '')
    const hasDisclosure = !!task.payload?.disclosure
    const persuasion = Math.min(1, text.length / 280)
    const clarity = link ? 1 : 0
    const budget = persuasion - (hasDisclosure ? 0.5 : 0) - clarity
    return budget
  }
  check(task, maxBudget = 0.2) {
    const b = this.compute(task)
    return b > maxBudget ? { ok: false, reason: 'TRANSPARENCY_BUDGET_EXCEEDED', budget: b } : { ok: true, budget: b }
  }
}
