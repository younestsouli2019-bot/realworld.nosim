# Payoneer Integration Readiness

## Overview
- Goal: Enable secure automated payouts, balance queries, beneficiary management, and webhook ingestion.
- Stack: Node.js services, strict policy modules, append-only HMAC audit logging.
- Account: email younestsouli2019@gmail.com, ID 85538995.

## Endpoints
- Webhook (production): POST https://{domain}/webhooks/payoneer
  - Verification: HMAC SHA-256 of raw body with secret in header x-payoneer-signature
  - Handler: src/real/psp/webhook-handlers.mjs: handlePayoneerWebhook
- Agent API (internal): 
  - POST /api/settlement/auto
  - POST /api/payout/paypal
  - POST /api/payout/status
  - GET /api/balance/paypal

## Security
- Secrets: stored in env (secret manager in cloud), never committed.
- Required env:
  - PAYONEER_WEBHOOK_SECRET
  - SWARM_LIVE=true
  - AUDIT_HMAC_SECRET
  - AGENT_API_TOKENS
- Audit: Append-only HMAC JSONL chain under audits/autonomous_hmac/YYYY-MM-DD.jsonl.
- Owner-only settlement enforced; middlemen disallowed.

## Data Model
- Webhook payload (example):
  ```json
  {
    "transaction_id": "PO-12345",
    "amount": 125.00,
    "currency": "USD",
    "timestamp": "2026-01-05T22:00:00Z",
    "recipient": "007810000448500030594182"
  }
  ```
- Evidence mapping:
  - type: "psp_transaction_id"
  - psp_id: transaction_id
  - amount/currency/timestamp/recipient propagated to ProofValidator

## Compliance
- Forensic-grade logs via append-only audit.
- Data minimization: store event IDs and amounts; avoid personal data in logs.
- Optional: IP allowlisting for webhook if provider supports.

## Operational Runbook
1. Set PAYONEER_WEBHOOK_SECRET and AUDIT_HMAC_SECRET.
2. Expose /webhooks/payoneer on public HTTPS (reverse proxy/Nginx).
3. Verify chain integrity daily: ExternalPaymentAPI.verifyAuditChainForDate(YYYY-MM-DD).
4. Reconcile payouts via ExternalGatewayManager.updateExternalPayoutStatus with provider tx IDs.

