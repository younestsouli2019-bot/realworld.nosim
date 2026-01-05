export function isPast72hUnsettled(event) {
  const t = new Date(event.occurredAt || event.created_date || event.created_at).getTime();
  if (!t) return false;
  const age = Date.now() - t;
  if (age <= 72 * 60 * 60 * 1000) return false;
  if (event.status === 'settled' || event.status === 'paid_out') return false;
  return true;
}
