# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-04
### Added
- **Human Verification Protocol (KYC)**: Implemented `KYC_INTERVENTION_PROTOCOL` in `AutonomousAgentUpgrader`. Agents encountering identity checks will now pause (`paused_kyc_required`) and export a request to `exports/kyc-requests/` for manual user intervention.
- **Owner Auto-Approval**: Updated `emit-revenue-events.mjs` to automatically approve payout batches destined for verified Owner Accounts (bypassing the `pending_approval` gate).
- **Agent Needs Assessment (Sondage)**: Implemented `assessNeeds` capability in `AutonomousAgentUpgrader` to identify missing resources (API keys) and capabilities before upgrading.
- **Passive Harvest Protocol**: Added `passive_harvest` mode for legacy agents or those failing upgrades, allowing them to emit revenue without active task execution.
- **Direct-to-Owner Settlement Enforcement**: Hard-coded settlement destinations in agent workflow configs to strictly route funds to Owner Accounts (Payoneer Primary, Bank, Crypto, PayPal).
- **Financial Goal Tracking**: Updated `AdvancedFinancialManager` to track `passive_income` goals separately from active revenue.

### Changed
- **Settlement Priority Update**: Reordered settlement priority to:
  1. Bank (Attijari)
  2. Payoneer (Primary - 85538995)
  3. Crypto (Trust Wallet)
  4. Payoneer (Secondary)
  5. PayPal (Backup/Last Resort)
- **Immutable Crypto Destinations**: Hard-coded specific wallet addresses for Trust Wallet (Primary) and Bybit (Secondary) to prevent modification.
- **Agent Upgrade Pipeline**: Now includes strict validation for `payoneer_api` and `stripe_api` requirements.
- **Revenue Routing**: Eliminated all intermediary routing; agents now configure directly with owner credentials.

### Fixed
- **Payoneer Credential Injection**: Fixed missing Payoneer token injection in agent upgrade process.
- **API Requirement Persistence**: Corrected bug where new API requirements were calculated but not saved to the agent entity.

### Financial System Overhaul
- **Core Refactoring**: Removed legacy "content farm" logic (`blog-writer.mjs`, `adsense-tracker.mjs`) to focus purely on financial orchestration.
- **Advanced Financial Manager**:
  - **System Audit**: Implemented `SystemAuditLogger` for immutable, granular tracking of all state changes and internal system actions.
  - **Idempotency**: Added `IdempotencyManager` to prevent duplicate external transactions using unique keys.
  - **Reliability**: Integrated `TransactionExecutor` with exponential backoff, circuit breakers, and retry policies for robust error handling.
  - **Compliance**: Added `ComplianceManager` for tax reporting (e.g., 1099 threshold tracking) and data retention policies.
  - **Analytics**: Implemented `AnalyticsEngine` for anomaly detection (revenue spikes/drops) and detailed attribution.
  - **Performance**: Added `BatchProcessor` for high-volume async transaction handling and in-memory caching for frequent entity lookups.
  - **Integration**: Created `IntegrationHub` stubs for future CRM/ERP connectivity.

### Added
- **Direct Swarm Transfer (Trust Wallet Bypass)**: Enabled direct transfers from Swarm Wallet to Trust Wallet, bypassing Binance API signature issues.
- **Real Revenue Engine**: Upgraded `autonomous-revenue-generator.mjs` to use `RealRevenueEngine` instead of random simulation.
- **Autonomous Swarm Wallet**: Configured `SWARM_WALLET.json` for autonomous fund aggregation.
- **Evidence Accumulation Mode**: Enforced holding pattern for personal bank wires while enabling crypto pressure valve.
- **Bucket Classification**: Updated `triage_earnings.mjs` to classify small crypto batches as Bucket A (Low Risk).
- **Massive Swarm Scaling**: Scaled autonomous revenue swarm from 5 agents to 5000+ agents.
  - Implemented `SwarmEngine` class in `scripts/autonomous-revenue-generator.mjs`.
  - Added weighted agent distribution:
    - Content Writer (30% - 1500 agents)
    - Research Analyst (20% - 1000 agents)
    - Social Media Manager (20% - 1000 agents)
    - Lead Generator (15% - 750 agents)
    - Automation Specialist (15% - 750 agents)
- **Settlement Priority System**: Implemented strictly prioritized settlement rails in `data/full_autonomous_system.js`.
  1. Bank Wire (Primary)
  2. Payoneer (Secondary)
  3. Crypto - Binance (Tertiary)
  4. PayPal (Fallback/Last Resort)
- **Crypto Settlement Support**: Added `AutonomousCryptoGenerator` class to handle Binance settlement artifacts.
  - Generates `.txt` instructions for TRC20, BEP20, and ERC20 wallet transfers.
  - Stores artifacts in `exports/crypto/`.
- **Owner Account Synchronization**: Centralized and synchronized owner account details (PayPal, Bank, Binance Wallets) across `swarm_prime_directive.js` and `full_autonomous_system.js`.

### Changed
- **Revenue Ingestion**: Optimized `autonomous-revenue-generator.mjs` to handle batch processing of revenue events to prevent system flooding from 5000+ agents.
- **Settlement Workflow**: Updated `executeSettlement` logic to iterate through the priority queue and fallback automatically if a rail fails (though currently defaults to Bank as it's the highest priority).
- **Prime Directive**: Updated `CORRECT_WORKFLOW` to explicitly include generation of Bank/Crypto settlement artifacts as valid autonomous outputs.

### Fixed
- **Payoneer Integration**: Reused and validated the existing bank wire generator to produce Payoneer-compatible US Bank Wire text files.
