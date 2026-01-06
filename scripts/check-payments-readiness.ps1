Param()
$ErrorActionPreference = "Stop"
function show($k, $v) { "{0}: {1}" -f $k, $v }
$live = [string]::IsNullOrEmpty($env:SWARM_LIVE) ? "not set" : $env:SWARM_LIVE
$audit = [string]::IsNullOrEmpty($env:AUDIT_HMAC_SECRET) ? "missing" : "present"
$pwh = [string]::IsNullOrEmpty($env:PAYONEER_WEBHOOK_SECRET) ? "missing" : "present"
$tokens = [string]::IsNullOrEmpty($env:AGENT_API_TOKENS) ? "missing" : "present"
Write-Output (show "SWARM_LIVE" $live)
Write-Output (show "AUDIT_HMAC_SECRET" $audit)
Write-Output (show "PAYONEER_WEBHOOK_SECRET" $pwh)
Write-Output (show "AGENT_API_TOKENS" $tokens)
Write-Output "Endpoints:"
Write-Output " - /webhooks/payoneer (public HTTPS recommended)"
Write-Output " - /api/settlement/auto (internal)"
Write-Output " - /api/audit/verify?date=YYYY-MM-DD (internal)"
Write-Output "Audit Chain:"
if ($env:AUDIT_HMAC_SECRET) {
  Write-Output " - verify with ExternalPaymentAPI.verifyAuditChainForDate(date)"
} else {
  Write-Output " - set AUDIT_HMAC_SECRET to enable verification"
}
