# Operational Manual

## System Architecture

### Components
- **Swarm Orchestrator**: Manages Agent lifecycle.
- **Smart Settlement Engine**: Routes funds.
- **Adaptive Rate Limiter**: Manages API quotas.

## Monitoring & Observability

### Health Checks
- **Command**: `scripts/monitor-revenue-health.mjs`
- **Metrics**:
  - Agent Status (Healthy/Unhealthy/Dead)
  - Queue Depth
  - Settlement Volume

### Rate Limits & Quotas
Managed by `AdaptiveRateLimiter.mjs`.

| Service | Limit | Action |
|---------|-------|--------|
| Binance | 1200 req/min | Exponential Backoff |
| OpenAI  | Token Bucket | Queue Task |
| Network | 50 req/sec | Throttle |

**Quota Exceeded**:
- Tasks are paused.
- System waits for token bucket refill.
- Admin alert generated (console/log).

## Deployment

### Prerequisites
- Node.js v18+
- Git
- Valid `.env` file

### Installation
```bash
git clone <repo>
cd <repo>
npm install
```

### Start Up
```bash
npm start
```
*Runs `scripts/run-swarm-orchestrated.mjs`*

## Troubleshooting

### Common Issues
1. **"Transaction Hash not found"**:
   - Cause: Blockchain congestion or manual failure.
   - Fix: Check explorer, update status manually or wait for `ChainVerifier` retry.
2. **"Rate Limit Exceeded"**:
   - Cause: Too many agents.
   - Fix: Reduce concurrency or wait.
3. **"Owner Verification Failed"**:
   - Cause: Environment variable mismatch or hacking attempt.
   - Fix: Ensure code is unmodified and Identity is hardcoded.
