# Testing & Validation Strategy

## Overview
The Swarm Financial System employs a rigorous testing strategy to ensure the integrity of autonomous revenue generation, settlement routing, and compliance enforcement.

## Test Levels

### 1. Unit Tests
Individual components are tested in isolation. Key critical paths include:
- **Settlement Logic**: `test-reconciliation-logic.mjs`
- **Owner Verification**: `test-owner-check.mjs`
- **Compliance**: `test-legal-compliance.mjs`

### 2. Integration Tests
Verifies the interaction between the Swarm Orchestrator, Agents, and Settlement Ledger.
- **Orchestration**: `test-swarm-orchestrator.mjs`
- **Revenue Flow**: `test-revenue-flow.mjs`

### 3. Live Mode Compliance
A specialized suite ensures no test data leaks into production and vice-versa.
- **Compliance Check**: `verify-live-mode-compliance.js`

## Running Tests

### Full Suite
To run the complete system integrity check:
```bash
npm test
```
*Executes `scripts/run-full-suite.mjs`*

### Individual Tests
```bash
node scripts/test-swarm-orchestrator.mjs
```

## Validation Process
1. **Pre-Commit**: Developers must run `npm test` locally.
2. **Deployment**: The CI pipeline (when implemented) runs the full suite.
3. **On-Chain Verification**: The `ChainVerifier` utility acts as a runtime test, verifying every transaction on the blockchain before marking it as complete.

## Coverage Goals
- **Financial Critical Paths**: 100% Coverage (Settlement, Ledger, Payouts)
- **Agent Logic**: 80% Coverage (Task execution, decision making)
