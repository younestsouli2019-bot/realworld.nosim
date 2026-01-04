#!/bin/bash
# deploy/production-deploy.sh
# Production deployment script for autonomous revenue settlement system

set -e  # Exit on error

echo "========================================"
echo "🚀 Autonomous Revenue Settlement System"
echo "   Production Deployment"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "⚠️  Warning: Running as root. Consider using a dedicated user."
fi

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "📁 Project Directory: $PROJECT_DIR"
echo ""

# Step 1: Check Node.js version
echo "✓ Step 1: Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"

# Step 2: Install dependencies
echo ""
echo "✓ Step 2: Installing dependencies..."
npm install --production
echo "   ✅ Dependencies installed"

# Step 3: Verify environment configuration
echo ""
echo "✓ Step 3: Verifying environment configuration..."
if [ ! -f ".env" ]; then
  echo "   ❌ ERROR: .env file not found"
  echo "   Copy env.production.template to .env and configure it"
  exit 1
fi

node scripts/verify-env.mjs
if [ $? -ne 0 ]; then
  echo "   ❌ Environment verification failed"
  exit 1
fi
echo "   ✅ Environment verified"

# Step 4: Test Base44 connectivity
echo ""
echo "✓ Step 4: Testing Base44 connectivity..."
if [ -f "verify-ledger-access.mjs" ]; then
  node verify-ledger-access.mjs
  if [ $? -ne 0 ]; then
    echo "   ⚠️  Base44 connectivity test failed"
    echo "   Continuing anyway..."
  else
    echo "   ✅ Base44 connected"
  fi
else
  echo "   ⚠️  verify-ledger-access.mjs not found, skipping"
fi

# Step 5: Test PayPal connectivity
echo ""
echo "✓ Step 5: Testing PayPal connectivity..."
if [ -f "check-connectivity.mjs" ]; then
  node check-connectivity.mjs
  if [ $? -ne 0 ]; then
    echo "   ⚠️  PayPal connectivity test failed"
    echo "   Continuing anyway..."
  else
    echo "   ✅ PayPal connected"
  fi
else
  echo "   ⚠️  check-connectivity.mjs not found, skipping"
fi

# Step 6: Create systemd service (Linux only)
echo ""
echo "✓ Step 6: Setting up system service..."

if [ "$(uname)" == "Linux" ]; then
  SERVICE_FILE="/etc/systemd/system/revenue-settlement.service"
  
  echo "   Creating systemd service: $SERVICE_FILE"
  
  sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Autonomous Revenue Settlement Daemon
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$(which node) $PROJECT_DIR/auto_settlement_daemon.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  echo "   ✅ Service file created"
  
  # Reload systemd
  sudo systemctl daemon-reload
  echo "   ✅ Systemd reloaded"
  
  # Enable service
  sudo systemctl enable revenue-settlement
  echo "   ✅ Service enabled (will start on boot)"
  
  # Start service
  sudo systemctl start revenue-settlement
  echo "   ✅ Service started"
  
  # Check status
  sleep 2
  if sudo systemctl is-active --quiet revenue-settlement; then
    echo "   ✅ Service is running"
  else
    echo "   ❌ Service failed to start"
    echo "   Check logs: sudo journalctl -u revenue-settlement -n 50"
    exit 1
  fi
  
else
  echo "   ⚠️  Not on Linux - systemd service not created"
  echo "   You'll need to run the daemon manually or use another service manager"
fi

# Step 7: Create monitoring cron job
echo ""
echo "✓ Step 7: Setting up monitoring..."

CRON_CMD="*/5 * * * * cd $PROJECT_DIR && node scripts/monitor-revenue-health.mjs >> logs/health-check.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "monitor-revenue-health.mjs"; then
  echo "   ℹ️  Monitoring cron job already exists"
else
  # Add cron job
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "   ✅ Monitoring cron job added (runs every 5 minutes)"
fi

# Create logs directory
mkdir -p logs
echo "   ✅ Logs directory created"

# Step 8: Deployment summary
echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================"
echo ""
echo "📊 System Status:"
if [ "$(uname)" == "Linux" ]; then
  echo "   Service: revenue-settlement"
  echo "   Status: $(sudo systemctl is-active revenue-settlement)"
  echo ""
  echo "📝 Useful Commands:"
  echo "   Check status:  sudo systemctl status revenue-settlement"
  echo "   View logs:     sudo journalctl -u revenue-settlement -f"
  echo "   Restart:       sudo systemctl restart revenue-settlement"
  echo "   Stop:          sudo systemctl stop revenue-settlement"
else
  echo "   Manual start:  node auto_settlement_daemon.js"
fi
echo ""
echo "   Health check:  node scripts/monitor-revenue-health.mjs"
echo "   Verify env:    node scripts/verify-env.mjs"
echo ""
echo "⏰ Next Steps:"
echo "   1. Monitor logs for first 24 hours"
echo "   2. Verify first settlement executes correctly"
echo "   3. Check owner accounts for received funds"
echo "   4. Review audit logs in ./audits/"
echo ""
echo "🎉 Autonomous revenue settlement is now LIVE!"
echo "========================================"
