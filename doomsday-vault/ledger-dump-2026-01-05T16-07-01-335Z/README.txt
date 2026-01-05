
DOOMSDAY LEDGER EXPORT
======================
Generated: 2026-01-05T16-07-01-335Z

This folder contains a snapshot of the autonomous agent's financial memory.
If the platform is censored or the server is unreachable, use these files 
to reconstruct the revenue history and unpaid obligations.

- base44-offline-store.json: The local database of revenue events.
- execution_history.json: The log of what the agent tried to do.
- missions/: Artifacts and work products created by the agents.
- migrate/: Pending settlements and bank wire batches.

TO RESTORE:
1. Place base44-offline-store.json in the project root.
2. Set BASE44_OFFLINE=true env var.
3. Run the daemon.
    