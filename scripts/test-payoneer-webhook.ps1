Param(
  [string]$Url = "http://127.0.0.1:8088/webhooks/payoneer"
)
$ErrorActionPreference = "Stop"
if (-not $env:PAYONEER_WEBHOOK_SECRET) {
  Write-Error "PAYONEER_WEBHOOK_SECRET is not set"
}
$payload = @{
  transaction_id = "PO-" + [guid]::NewGuid().ToString().Substring(0,8)
  amount = 125.00
  currency = "USD"
  timestamp = (Get-Date).ToString("s") + "Z"
  recipient = "007810000448500030594182"
} | ConvertTo-Json -Depth 5
$hmac = [System.BitConverter]::ToString((New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($env:PAYONEER_WEBHOOK_SECRET))).ComputeHash([Text.Encoding]::UTF8.GetBytes($payload))).Replace("-", "").ToLower()
Invoke-WebRequest -Uri $Url -Method POST -ContentType "application/json" -Body $payload -Headers @{ "x-payoneer-signature" = $hmac }

