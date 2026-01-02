# Emergency Unblock Script
# Detects and disables the Portmaster/Safing Network Filter Driver

Write-Host "Checking for blocking Network Drivers..." -ForegroundColor Cyan

$bindings = Get-NetAdapterBinding | Where-Object { $_.DisplayName -match "Safing" -or $_.DisplayName -match "Portmaster" }

if ($bindings) {
    Write-Host "Found Portmaster Network Filter Driver active." -ForegroundColor Yellow
    
    foreach ($binding in $bindings) {
        Write-Host "   - Found on adapter: $($binding.Name)"
        try {
            Disable-NetAdapterBinding -Name $binding.Name -ComponentID $binding.ComponentID -ErrorAction Stop
            Write-Host "   Successfully disabled on $($binding.Name)" -ForegroundColor Green
        } catch {
            Write-Host "   Failed to disable on $($binding.Name): $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No Portmaster Driver found active in network bindings." -ForegroundColor Gray
}

Write-Host "Refreshing Network Configuration..." -ForegroundColor Cyan
ipconfig /flushdns

Write-Host "Testing Connectivity to Payoneer..." -ForegroundColor Cyan
try {
    $result = Test-NetConnection -ComputerName "www.payoneer.com" -Port 443
    if ($result.TcpTestSucceeded) {
        Write-Host "SUCCESS: Payoneer is REACHABLE!" -ForegroundColor Green
    } else {
        Write-Host "FAILURE: Still blocked." -ForegroundColor Red
    }
} catch {
    Write-Host "Error running connectivity test: $_" -ForegroundColor Red
}
