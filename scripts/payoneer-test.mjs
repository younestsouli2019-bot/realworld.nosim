import '../src/load-env.mjs';
import { getAccessToken } from '../src/financial/payoneer/PayoneerOAuth.mjs';
import { broadcastPayoneer } from '../src/financial/broadcast/PayoneerBroadcaster.mjs';

async function main() {
  const tokenRes = await getAccessToken();
  console.log('TOKEN_RES', JSON.stringify(tokenRes));
  const tx = [{ amount: 1, currency: 'USD', destination: process.env.OWNER_PAYONEER_EMAIL, reference: 'Test' }];
  const sendRes = await broadcastPayoneer(tx);
  console.log('SEND_RES', JSON.stringify(sendRes));
}

main();

