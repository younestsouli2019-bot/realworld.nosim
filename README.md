# Autonomous Revenue Swarm

## Overview
This system is an autonomous revenue generation and settlement engine designed to operate with minimal human intervention. It leverages a swarm of specialized agents to identify opportunities, execute tasks, and settle funds to verified owner accounts.

## 📚 Documentation
Comprehensive documentation is available in the `docs/` directory:

- **[Testing Strategy](docs/TESTING_STRATEGY.md)**: Details on unit, integration, and live-mode testing.
- **[Security Policy](docs/SECURITY_POLICY.md)**: "No Private Key" policy, owner-only settlement, and audit trails.
- **[Disaster Recovery](docs/DISASTER_RECOVERY.md)**: Backup procedures, restoration guides, and Bunker Mode.
- **[Operational Manual](docs/OPERATIONAL_MANUAL.md)**: Monitoring, deployment, and rate limit management.
- **[Compliance Framework](docs/COMPLIANCE_FRAMEWORK.md)**: GDPR, KYC, AML, and tax reporting standards.

## 🚀 Quick Start

### Installation
```bash
git clone <repo_url>
npm install
```

### Running the System
```bash
npm start
```
*Starts the Swarm Orchestrator with full health monitoring and rate limiting.*

### Testing
```bash
npm test
```
*Runs the full system integrity suite.*

### Disaster Recovery Backup
```bash
npm run backup
```
*Creates a snapshot of critical data.*

## 🛡️ Core Principles
1. **No Simulation**: All actions must be real.
2. **Owner Only**: Funds only move to verified accounts.
3. **Proof of Settlement**: All status updates require external proof.
