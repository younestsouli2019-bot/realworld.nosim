# Base44 Mitigation & Continuity Plan

## 1. Objective
Ensure zero data loss and minimal operational downtime in the event of Base44 platform instability, acquisition, policy changes, or permanent discontinuation.

## 2. Data Sovereignty Strategy (Implemented)
The system now enforces **100% Data Sovereignty** via the following mechanisms:

### A. Automated Full-State Backups
- **Mechanism**: The `autonomous-daemon` runs a `fullBackup` task periodically (default: every hour).
- **Storage**: JSON dumps of all critical entities are stored in `backups/YYYY-MM-DD_HH-mm-ss/`.
- **Entities Covered**:
  - `RevenueEvent` (Incoming money)
  - `PayoutBatch` (Outgoing money)
  - `PayoutItem` (Line items)
  - `PayPalWebhookEvent` (Audit trail)
  - `PayPalMetric` (Health stats)
  - `TransactionLog` (Ledger)

### B. Local-First Offline Store
- **File**: `.base44-offline-store.json`
- **Function**: Acts as a "hot" local database. If Base44 API is unreachable (404/500/Network Error), the daemon automatically switches to this store to continue processing payouts and migrations.

## 3. Operational Continuity Scenarios

### Scenario A: Temporary Outage (Base44 Down)
**Status**: Handled Automatically.
1. Daemon detects network error or 5xx response.
2. Switches to `offline` mode.
3. Reads/Writes to `.base44-offline-store.json`.
4. Migration loops (Bank Wire/PayPal) continue executing based on local data.
5. When Base44 returns, data is synced (implementation pending bi-directional sync, currently prioritizes local execution).

### Scenario B: Permanent Disappearance (Base44 Gone)
**Action Plan**:
1. **Stop Sync**: Disable `SWARM_LIVE` to prevent error loops.
2. **Promote Backup**: Use the latest `backups/` snapshot as the source of truth.
3. **Migrate Backend**:
   - The `base44-client.mjs` is designed with an adapter pattern.
   - **Immediate Fix**: Continue running in "Offline Mode" permanently. The `.base44-offline-store.json` can sustain operations indefinitely for moderate volumes.
   - **Long-Term Fix**: Replace the "Online" client in `base44-client.mjs` with a connector to a standard database (PostgreSQL/Supabase/Firebase) using the exported JSON data to seed the new DB.

## 4. Restoration Procedure

### To Restore from Backup:
If the live environment is corrupted or lost:
1. Locate the latest backup in `backups/`.
2. Copy the JSON files to a safe location.
3. To restore to "Offline Mode":
   - Load the JSON data into `.base44-offline-store.json` structure (Script `src/restore-offline-from-backup.mjs` can be created if needed).
   - Restart daemon with `offline.enabled: true` in `autonomous.txt`.

## 5. Alternatives & Escape Hatch
- **Payouts**: The `create-payout-batches.mjs` and `submit-payout-batch.mjs` scripts can run independently of Base44 if provided with a local data source.
- **Revenue**: `emit-revenue-events.mjs` can be redirected to write to a local log file instead of Base44 API.

## 6. Verification
- Check `backups/` directory to confirm JSON files are being generated.
- Run `node src/backup-runner.mjs` manually to test the dump process.
