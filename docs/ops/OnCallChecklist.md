# On-Call Checklist

## Before Go-Live
- Set SWARM_LIVE, AUDIT_HMAC_SECRET, PAYONEER_WEBHOOK_SECRET.
- Start agent HTTP server and validate /webhooks/payoneer.
- Verify audit chain with ExternalPaymentAPI.verifyAuditChainForDate.

## Daily
- Readiness script: environment, endpoints, audit chain.
- Webhook monitoring: 2xx rates, verification OK.
- Pending payouts review; route optimizer status.

## Incident Response
- Switch to bank wire export if PSP fails.
- Use crypto broadcast where permitted.
- Append manual evidence to audit chain; reconcile statuses.

## Contacts
- Payoneer partner support
- Bank portal support
- Cloud ops for HTTPS/SSL issues
