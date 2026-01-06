Param()
$ErrorActionPreference = "Stop"
if (-not $env:SWARM_LIVE) { $env:SWARM_LIVE = "true" }
if (-not $env:AGENT_API_TOKENS) { $env:AGENT_API_TOKENS = "internal-token" }
if (-not $env:AUDIT_HMAC_SECRET) { Write-Error "Set AUDIT_HMAC_SECRET before starting" }
node ".\src\api\external-payment-server.mjs"

