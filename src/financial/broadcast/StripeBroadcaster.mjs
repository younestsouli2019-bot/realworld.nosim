export async function broadcastStripe(transactions) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { status: 'missing_config' };
  const url = process.env.STRIPE_API_URL || 'https://api.stripe.com/v1/transfers';
  const results = [];
  for (const t of transactions) {
    const form = new URLSearchParams();
    form.set('amount', String(Math.round(Number(t.amount || 0) * 100)));
    form.set('currency', (t.currency || 'usd').toLowerCase());
    form.set('destination', t.destination || '');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    const ok = res.ok;
    const body = await res.text();
    results.push({ ok, body });
  }
  return { status: 'sent', results };
}

