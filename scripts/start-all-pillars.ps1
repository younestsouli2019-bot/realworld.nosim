# Start-All-Pillars.ps1
# Launches the 4 Critical Pillars of the Autonomous Swarm

$Env:SWARM_LIVE = "true"
$Env:BASE44_OFFLINE = "false" # Ensure we attempt live connections (or fail gracefully to local logic if configured)
$Env:PAYPAL_MODE = "live"

Write-Host "🚀 LAUNCHING AUTONOMOUS SWARM PILLARS" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green

# 1. Connectivity (API Gateway)
Write-Host "📡 Starting Connectivity Pillar (API Gateway)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $Host.UI.RawUI.WindowTitle = 'Pillar 1: Connectivity'; node scripts/start-agent-http.ps1 }"

# 2. Operations (Swarm Supervisor Loop)
Write-Host "⚙️  Starting Operations Pillar (Swarm Supervisor)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $Host.UI.RawUI.WindowTitle = 'Pillar 2: Operations'; node scripts/auto-restart-loop.js }"

# 3. Finance (Revenue Orchestrator)
Write-Host "💰 Starting Finance Pillar (Revenue Orchestrator)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $Host.UI.RawUI.WindowTitle = 'Pillar 3: Finance'; node scripts/autonomous-revenue-generator.mjs }"

# 4. Fusion (LazyArk Protocol)
Write-Host "🧬 Starting Fusion Pillar (Agent Fusion)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $Host.UI.RawUI.WindowTitle = 'Pillar 4: Fusion'; node scripts/run-lazyark-fusion.mjs }"

Write-Host "✅ All pillars launched in new windows." -ForegroundColor Cyan
Write-Host "   Monitor the individual windows for logs."
