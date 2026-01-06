export async function getAccessToken() {
  const base = (process.env.PAYONEER_API_URL || '').replace(/\/$/, '');
  const id = process.env.PAYONEER_CLIENT_ID;
  const secret = process.env.PAYONEER_CLIENT_SECRET;
  if (!base || !id || !secret) return { status: 'missing_config' };
  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', id);
  body.set('client_secret', secret);
  const res = await fetch(base + '/oauth/token', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) return { status: 'error', code: res.status, message: await res.text() };
  const json = await res.json().catch(() => ({}));
  const token = json.access_token;
  if (!token) return { status: 'error', message: 'no_access_token' };
  return { status: 'ok', token };
}

