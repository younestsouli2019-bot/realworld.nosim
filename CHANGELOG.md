# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-04

### Added
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
