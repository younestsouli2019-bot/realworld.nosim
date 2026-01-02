# Diagnostic Script for DNS
Write-Host "1. Checking Current DNS Server Addresses..." -ForegroundColor Cyan
Get-DnsClientServerAddress | Where-Object { $_.ServerAddresses -ne $null } | Select-Object InterfaceAlias, ServerAddresses

Write-Host "`n2. Testing Name Resolution (Default)..." -ForegroundColor Cyan
try {
    Resolve-DnsName -Name "www.payoneer.com" -ErrorAction Stop
    Write-Host "✅ Default Resolution: SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "❌ Default Resolution: FAILED ($($_.Exception.Message))" -ForegroundColor Red
}

Write-Host "`n3. Testing Name Resolution (Google 8.8.8.8)..." -ForegroundColor Cyan
try {
    Resolve-DnsName -Name "www.payoneer.com" -Server "8.8.8.8" -ErrorAction Stop
    Write-Host "✅ Google (8.8.8.8) Resolution: SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "❌ Google (8.8.8.8) Resolution: FAILED ($($_.Exception.Message))" -ForegroundColor Red
}

Write-Host "`n4. Testing TCP Connection to 8.8.8.8:53..." -ForegroundColor Cyan
try {
    $test = Test-NetConnection -ComputerName "8.8.8.8" -Port 53
    if ($test.TcpTestSucceeded) {
        Write-Host "✅ Port 53 Outbound: OPEN" -ForegroundColor Green
    } else {
        Write-Host "❌ Port 53 Outbound: BLOCKED" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error testing port 53"
}
