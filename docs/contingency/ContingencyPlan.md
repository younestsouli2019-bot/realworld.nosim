# Payment Rail Contingency Plan

## Scenarios
1. Payoneer onboarding delayed: use bank wire primacy and crypto fallback.
2. Webhook verification issues: switch to polling with provider dashboard and log manual confirmations.
3. PSP downtime: queue payouts and batch-export bank files for manual upload; resume automatically.

## Fallbacks
- Bank wire: prepare files and upload to Attijari/Payoneer bank portals.
- Crypto: broadcast prepared transactions when PayPal/Stripe restricted.
- Stripe/PayPal: use only in permitted jurisdictions; otherwise bypass per policy.

## Operations
- Enable SWARM_LIVE; keep AUDIT_HMAC_SECRET set.
- Expose /webhooks/payoneer; verify HMAC.
- Run readiness checks daily; verify audit chain.
- Record manual settlement proofs when automated signals fail.

## Recovery
- Retry failed routes with withRetry and route optimizer.
- Reconcile using provider tx IDs and append-only audit entries.
- Backfill events with verified proofs; block unverified changes.
