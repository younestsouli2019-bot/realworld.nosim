# Disaster Recovery & Business Continuity

## Overview
This document outlines the procedures for recovering the Swarm Financial System in the event of data loss, corruption, or catastrophic failure.

## Backup Strategy

### Automated Backups
- **Script**: `scripts/system-backup.mjs`
- **Frequency**: Daily (Recommended cron job)
- **Scope**:
  - `data/`: All ledgers, queues, and market data.
  - `config/`: Agent configurations.
  - `exports/`: Generated settlement artifacts.

### Execution
To trigger an immediate backup:
```bash
npm run backup
```
*Creates a timestamped snapshot in `backups/YYYY-MM-DD-HH-mm-ss/`*

## Recovery Procedures

### Scenario 1: Ledger Corruption
1. **Stop the Swarm**: `Ctrl+C` or `pm2 stop all`.
2. **Locate Backup**: Find the most recent valid snapshot in `backups/`.
3. **Restore**:
   ```bash
   cp -r backups/2026-01-04-12-00-00/data/financial/settlement_ledger.json data/financial/
   ```
4. **Verify**: Run `scripts/check-settlement-status.mjs` to ensure integrity.
5. **Restart**: `npm start`.

### Scenario 2: Total System Loss
1. **Clone Repository**: `git clone <repo_url>`
2. **Restore Environment**: Re-create `.env` from secure storage (LastPass/1Password).
3. **Restore Data**: Copy the contents of the latest backup into the project root.
4. **Install Dependencies**: `npm install`
5. **Run Integrity Check**: `npm test`

## Bunker Mode
In case of internet censorship or API blocking (403/451):
1. System automatically enters **Bunker Mode**.
2. All transactions are QUEUED locally.
3. `Doomsday Export` is triggered to save state to local disk.
