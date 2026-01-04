import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';

// Load Env
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key) env[key.trim()] = value.trim();
});

const API_KEY = '303Y3Do3L5EdG8gQeBbKir3WOSV4zSkc2fD78D7L85H7BZUH5rySb9Xo7vLayZHZ';
const API_SECRET = 'I3vpUWrJ1LXbNqZ6K5PRbOrS9Nk8PJ7Uk4YOv6bFg1p67WtBbYKFZgvGOHI9eGy1';

console.log('API Key Length:', API_KEY.length);
console.log('API Secret Length:', API_SECRET.length);

async function syncTime() {
  return new Promise((resolve, reject) => {
    https.get('https://api.binance.com/api/v3/time', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const serverTime = JSON.parse(data).serverTime;
          const offset = serverTime - Date.now();
          console.log('Time Offset:', offset);
          resolve(offset);
        } catch (e) { reject(e); }
      });
    });
  });
}

async function run() {
  const offset = await syncTime();
  const timestamp = Date.now() + offset;
  
  const params = {
    timestamp: timestamp
  };

  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
    
  console.log('Secret Chars:', API_SECRET.split('').map(c => c.charCodeAt(0)).join(','));

  const signature = crypto
    .createHmac('sha256', API_SECRET)
    .update(queryString)
    .digest('hex');

  const fullQuery = `${queryString}&signature=${signature}`;
  
  console.log('Query String to Sign:', queryString);
  console.log('Signature:', signature);

  const options = {
    hostname: 'api.binance.com',
    path: `/api/v3/account?${fullQuery}`,
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': API_KEY
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', data.substring(0, 500));
    });
  });

  req.end();
}

run();
