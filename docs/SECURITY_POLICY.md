# Security Policy & Audit Trail

## Core Principles

### 1. No Private Keys
**POLICY: STRICTLY FORBIDDEN**
The system **NEVER** stores, handles, or accesses private keys for cryptocurrency wallets.
- **Settlement**: Done via Exchange APIs (Binance) or Manual Intervention.
- **Verification**: Done via public RPC nodes (`ChainVerifier`).

### 2. Owner-Only Settlement
Funds can **ONLY** be routed to hardcoded, verified Owner Accounts.
- **Identity**: Younes Tsouli (CIN: A337773)
- **Destinations**: 
  - Bank: Attijari (0078...)
  - Payoneer: Primary (8553...)
  - Crypto: Trust Wallet (0xA4...)

### 3. Immutable Ledger
All financial state changes are recorded in `data/financial/settlement_ledger.json`.
- **Atomic Writes**: Protected by `MutexLock` to prevent race conditions.
- **Audit Trail**: Every status change (QUEUED -> PENDING -> COMPLETED) is logged.

## Access Control

### Environment Variables
Sensitive credentials (API Keys) are injected via `.env` and are **NEVER** committed to version control.
- `BINANCE_API_KEY`
- `PAYONEER_TOKEN`
- `STRIPE_SECRET_KEY`

### File Permissions
- `data/financial/`: Restricted write access (System Only).
- `docs/`: Read-only for Agents.

## Incident Response
1. **Detection**: `HealthMonitor` detects failures or anomalies.
2. **Containment**: `SwarmOrchestrator` halts affecting agents.
3. **Resolution**: `FailureHandler` moves items to Dead Letter Queue for manual review.

## Audit Logs
- **Location**: `logs/system_audit.log` (Implementation Pending)
- **Retention**: 90 Days.
