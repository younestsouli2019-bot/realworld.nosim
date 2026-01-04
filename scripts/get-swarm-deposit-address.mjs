import https from 'https';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim();
});

const API_KEY = env.BINANCE_API_KEY;
const API_SECRET = env.BINANCE_API_SECRET;

async function getDepositAddress() {
  console.log('🔍 FETCHING SWARM INGESTION ADDRESS (Binance Deposit)...');

  // 1. Time Sync
  const serverTime = await new Promise((resolve) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).serverTime));
    });
  });
  
  const timestamp = serverTime;
  const params = {
    coin: 'USDT',
    network: 'BSC',
    timestamp,
    recvWindow: 60000
  };

  // Sort keys alphabetically
  const queryString = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
  const fullQuery = `${queryString}&signature=${signature}`;

  const options = {
    hostname: 'api.binance.com',
    path: `/sapi/v1/capital/deposit/address?${fullQuery}`,
    method: 'GET',
    headers: { 'X-MBX-APIKEY': API_KEY }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (res.statusCode === 200) {
        const json = JSON.parse(data);
        console.log('\n✅ SWARM AGGREGATOR ADDRESS IDENTIFIED:');
        console.log(`   Coin: ${json.coin}`);
        console.log(`   Address: ${json.address}`);
        console.log(`   Tag: ${json.tag || 'None'}`);
        console.log(`   URL: ${json.url}`);
        
        // Save this to a file so the "Swarm" knows where to pay
        const swarmConfig = `
SWARM_INGESTION_WALLET:
  address: ${json.address}
  network: BSC (BEP20)
  role: REVENUE_AGGREGATOR
  action: AUTO_FORWARD_TO_TRUST_WALLET
`;
        fs.writeFileSync('SWARM_INGESTION_WALLET.yaml', swarmConfig);
        console.log('\n📄 Saved to SWARM_INGESTION_WALLET.yaml');
      } else {
        console.error(`❌ Failed: ${res.statusCode} ${data}`);
      }
    });
  });

  req.end();
}

getDepositAddress();
