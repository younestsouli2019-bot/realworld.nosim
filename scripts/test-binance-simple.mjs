import https from 'https';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Load env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) env[k.trim()] = v.trim();
});

const API_KEY = env.BINANCE_API_KEY;
const API_SECRET = env.BINANCE_API_SECRET;

console.log('Testing Binance Connectivity...');
console.log(`Key: ${API_KEY.substring(0,5)}...`);
console.log(`Secret: ${API_SECRET.substring(0,5)}...`);

async function test() {
  // 1. Get Server Time
  const serverTime = await new Promise((resolve) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).serverTime));
    });
  });
  
  const localTime = Date.now();
  const offset = serverTime - localTime;
  console.log(`Server Time: ${serverTime}`);
  console.log(`Local Time:  ${localTime}`);
  console.log(`Offset:      ${offset}`);

  // 2. Prepare Request
  const timestamp = Date.now() + offset;
  // const timestamp = serverTime; // Try using server time directly?
  
  const params = {
    timestamp: timestamp
  };
  
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
  const fullQuery = `${queryString}&signature=${signature}`;
  
  const options = {
    hostname: 'api.binance.com',
    path: `/api/v3/account?${fullQuery}`,
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY
    }
  };
  
  console.log(`Requesting: ${options.path}`);
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Body: ${data}`);
    });
  });
  
  req.end();
}

test();
