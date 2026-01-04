# Autonomous Settlement Swarm - Independent Deployment

This package allows you to run the **Autonomous Settlement Swarm** independently on a cloud server (VPS, Render, Railway, Heroku), ensuring 24/7 execution without relying on your local machine.

## 🚀 Purpose
- **Monitoring**: Continuously scans for pending revenue.
- **Settlement**: Automatically wires funds to Owner (PayPal/Bank) upon detection.
- **Resilience**: Immune to local connectivity issues, firewall blocks, or laptop shutdowns.

## 📦 Contents
- `src/worker.js`: The core autonomous engine.
- `data/autonomous/ledger/`: Contains your current pending revenue records (migrated from local).
- `Dockerfile`: For containerized deployment.

## 🛠 Deployment Instructions

### Option 1: Docker (Recommended)
1.  Upload this `deployment` folder to any VPS or Docker host.
2.  Build and run:
    ```bash
    docker build -t swarm-settlement .
    docker run -d --restart always \
      -e PAYPAL_CLIENT_ID="your_client_id" \
      -e PAYPAL_SECRET="your_secret" \
      -e PAYPAL_MODE="live" \
      swarm-settlement
    ```

### Option 2: Cloud PaaS (Render/Railway)
1.  Push this folder to a private GitHub repository.
2.  Connect it to Render/Railway.
3.  Set the following Environment Variables in the dashboard:
    - `PAYPAL_CLIENT_ID`
    - `PAYPAL_SECRET`
    - `PAYPAL_MODE` = `live`
4.  Deploy. The "Start Command" is `npm start`.

### Option 3: Standard Node.js Server
1.  Upload files to server.
2.  Install dependencies: `npm install`
3.  Create a `.env` file with your credentials.
4.  Run: `npm start`

## ✅ Verification
Check the logs on your server. You will see:
- `🔍 Scanning for pending settlements...`
- `💰 EXECUTING AUTONOMOUS SETTLEMENT`
- `✅ SETTLEMENT EXECUTED SUCCESSFULLY`

The system will now manage your revenue streams independently.
