import { getAccessToken } from '../payoneer/PayoneerOAuth.mjs';

export async function broadcastPayoneer(transactions) {
  const url = process.env.PAYONEER_API_URL;
  let token = process.env.PAYONEER_TOKEN;
  if (!token) {
    const oauth = await getAccessToken();
    if (oauth.status !== 'ok') return oauth;
    token = oauth.token;
  }
  if (!url || !token) return { status: 'missing_config' };
  const res = await fetch(url.replace(/\/$/, '') + '/payouts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: transactions })
  });
  if (!res.ok) return { status: 'error', code: res.status, message: await res.text() };
  const data = await res.json().catch(() => ({}));
  return { status: 'sent', data };
}
