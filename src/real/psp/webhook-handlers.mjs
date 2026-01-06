import crypto from 'node:crypto';
import { verifyPayPalWebhookSignature, extractPayPalWebhookHeaders } from '../../paypal-api.mjs';
import { mapPayPalWebhookToRevenueEvent } from '../../paypal-event-mapper.mjs';
import { ProofValidator } from '../proof-validator.mjs';

export async function handlePayPalWebhook(req, rawBody) {
  const headers = extractPayPalWebhookHeaders(req.headers || {});
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  const verified = webhookId ? await verifyPayPalWebhookSignature({ headers, body: rawBody, webhookId }) : false;
  const event = verified ? mapPayPalWebhookToRevenueEvent(JSON.parse(rawBody)) : null;
  const proof = event ? {
    type: 'psp_transaction_id',
    psp_id: event?.metadata?.psp_transaction_id || event?.resource?.id || headers['paypal-transmission-id'] || '',
    amount: Number(event.amount || event?.resource?.amount?.value || 0),
    currency: String(event.currency || event?.resource?.amount?.currency_code || '').toUpperCase(),
    timestamp: event.occurredAt || new Date().toISOString(),
    recipient: event?.metadata?.beneficiary || null
  } : null;
  if (event && proof) {
    await ProofValidator.assertValid({ ...event, verification_proof: proof });
  }
  return { provider: 'paypal', verified, event, proof };
}

export async function handleStripeWebhook(headers, rawBody) {
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET || '';
  let verified = false;
  let event = null;
  if (endpointSecret && headers['stripe-signature']) {
    const mod = await import('stripe');
    const stripe = mod.default('');
    try {
      event = stripe.webhooks.constructEvent(rawBody, headers['stripe-signature'], endpointSecret);
      verified = true;
    } catch {}
  }
  const amount = Number(event?.data?.object?.amount ? event.data.object.amount / 100 : 0);
  const currency = String(event?.data?.object?.currency || '').toUpperCase();
  const txId = event?.data?.object?.id || '';
  const proof = {
    type: 'psp_transaction_id',
    psp_id: txId,
    amount,
    currency,
    timestamp: new Date().toISOString(),
    recipient: null
  };
  return { provider: 'stripe', verified, event, proof };
}

export async function handlePayoneerWebhook(headers, rawBody) {
  const signature = headers['x-payoneer-signature'] || '';
  const secret = process.env.PAYONEER_WEBHOOK_SECRET || '';
  const h = secret ? crypto.createHmac('sha256', secret).update(rawBody).digest('hex') : '';
  const verified = Boolean(secret) && h === signature;
  let payload = null;
  try { payload = JSON.parse(rawBody); } catch { payload = null; }
  const amount = Number(payload?.amount || 0);
  const currency = String(payload?.currency || '').toUpperCase();
  const pspId = payload?.transaction_id || '';
  const proof = { type: 'psp_transaction_id', psp_id: pspId, amount, currency, timestamp: payload?.timestamp || new Date().toISOString(), recipient: payload?.recipient || null };
  return { provider: 'payoneer', verified, event: payload, proof };
}

export async function handleBankWireWebhook(headers, rawBody) {
  let payload = null;
  try { payload = JSON.parse(rawBody); } catch { payload = null; }
  const ref = payload?.bank_ref || payload?.reference || '';
  const amount = Number(payload?.amount || 0);
  const currency = String(payload?.currency || '').toUpperCase();
  const proof = { type: 'psp_transaction_id', psp_id: ref, amount, currency, timestamp: payload?.timestamp || new Date().toISOString(), recipient: payload?.recipient || null };
  return { provider: 'bank_wire', verified: Boolean(ref), event: payload, proof };
}

