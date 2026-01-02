import fs from 'fs';
import path from 'path';

// Load env
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [k, v] = line.split('=');
            if (k && v) process.env[k.trim()] = v.trim();
        });
    } catch (e) {}
}
loadEnv();

const APP_ID = process.env.BASE44_APP_ID;
const TOKEN = process.env.BASE44_SERVICE_TOKEN;

console.log('--- DEBUG AUTH ---');
console.log(`App ID: ${APP_ID}`);
console.log(`Token:  ${TOKEN?.slice(0, 5)}...`);

const URL = `https://base44.app/api/apps/${APP_ID}/entities/RevenueEvent`;

async function tryAuth(name, headers) {
    console.log(`\nTesting ${name}...`);
    try {
        const res = await fetch(URL, { 
            headers: {
                'Content-Type': 'application/json',
                'X-App-Id': APP_ID,
                ...headers
            } 
        });
        
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Body:   ${text.slice(0, 200)}...`);
        
        if (res.status === 200) {
            console.log('✅ SUCCESS!');
            return true;
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
    return false;
}

async function run() {
    // 1. Standard Bearer (SDK Default)
    await tryAuth('Bearer Token', { 'Authorization': `Bearer ${TOKEN}` });

    // 2. X-Service-Token
    await tryAuth('X-Service-Token', { 'X-Service-Token': TOKEN });

    // 3. Api-Key
    await tryAuth('Api-Key', { 'apikey': TOKEN });
    
    // 4. Token in Query (sometimes works)
    console.log('\nTesting Query Param...');
    try {
        const res = await fetch(`${URL}?token=${TOKEN}`, { 
             headers: { 'X-App-Id': APP_ID }
        });
        console.log(`Status: ${res.status}`);
    } catch (e) {}
}

run();
