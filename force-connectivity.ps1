# Force Connectivity Fix Script
# This script bypasses Portmaster DNS interception to restore immediate connectivity.

Write-Host "1. Stopping Portmaster Service to prevent interference..." -ForegroundColor Cyan
Stop-Service -Name PortmasterCore -Force -ErrorAction SilentlyContinue

Write-Host "2. Detecting Active Network Adapters..." -ForegroundColor Cyan
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }

if ($adapters) {
    foreach ($adapter in $adapters) {
        Write-Host "   - Configuring Adapter: $($adapter.Name) to use Google/Cloudflare DNS..."
        try {
            Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ("8.8.8.8", "1.1.1.1") -ErrorAction Stop
            Write-Host "     ✅ DNS Updated." -ForegroundColor Green
        } catch {
            Write-Host "     ⚠️ Could not update adapter $($adapter.Name). Run as Admin!" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ No active network adapters found!" -ForegroundColor Red
}

Write-Host "3. Flushing Windows DNS Cache..." -ForegroundColor Cyan
ipconfig /flushdns

Write-Host "4. Testing Connection to Payoneer..." -ForegroundColor Cyan
try {
    $test = Test-NetConnection -ComputerName "www.payoneer.com" -Port 443 -InformationLevel Detailed
    if ($test.TcpTestSucceeded) {
        Write-Host "✅ SUCCESS: Connection to Payoneer RESTORED!" -ForegroundColor Green
        Write-Host "   You can now proceed with the transfer." -ForegroundColor Gray
    } else {
        Write-Host "❌ FAILURE: Connection still blocked." -ForegroundColor Red
        Write-Host "   Debug Info:"
        $test
    }
} catch {
    Write-Host "❌ Error testing connection: $_" -ForegroundColor Red
}
