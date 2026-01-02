$configPath = "C:\ProgramData\Safing\Portmaster\config.json"
$backupPath = "C:\ProgramData\Safing\Portmaster\config.json.bak"

try {
    Write-Host "Backing up config..."
    Copy-Item -Path $configPath -Destination $backupPath -Force
    
    Write-Host "Reading config..."
    $json = Get-Content $configPath -Raw | ConvertFrom-Json
    
    Write-Host "Updating DNS settings to Standard (1.1.1.1 / 8.8.8.8)..."
    $json.dns.nameservers = @(
        "dot://cloudflare-dns.com?ip=1.1.1.1&name=Cloudflare",
        "dot://dns.google?ip=8.8.8.8&name=Google"
    )
    
    $newContent = $json | ConvertTo-Json -Depth 5
    Set-Content -Path $configPath -Value $newContent
    
    Write-Host "Restarting PortmasterCore service..."
    Restart-Service -Name PortmasterCore -Force
    
    Write-Host "✅ Success! Portmaster updated and restarted."
    
    Start-Sleep -Seconds 5
    Write-Host "Testing connectivity..."
    $test = Test-NetConnection -ComputerName www.payoneer.com -Port 443
    if ($test.TcpTestSucceeded) {
        Write-Host "Connection Successful!" -ForegroundColor Green
    } else {
        Write-Host "Connection Failed." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_"
    Write-Host "You may need to run this script as Administrator."
}
