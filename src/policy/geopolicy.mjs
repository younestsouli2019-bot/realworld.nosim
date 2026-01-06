import fs from 'fs';
import path from 'path';

function hasMoroccoPayPalRestrictionFlag() {
  const root = process.cwd();
  const candidates = [
    'paypalrestrictions..inmorocco).txt',
    'paypalrestrictions.inmorocco.txt',
    'paypal-restrictions-in-morocco.txt'
  ];
  return candidates.some(name => {
    try {
      return fs.existsSync(path.join(root, name));
    } catch {
      return false;
    }
  });
}

export function shouldAvoidPayPal() {
  const c = (process.env.OWNER_COUNTRY || '').toUpperCase();
  if (String(process.env.PAYPAL_DISABLED || '').toLowerCase() === 'true') return true;
  if (String(process.env.PAYPAL_RESTRICTED_COUNTRY || '').toUpperCase() === 'MA') return true;
  if (hasMoroccoPayPalRestrictionFlag()) return true;
  return c === 'MA';
}

export function preferredSettlement() {
  return shouldAvoidPayPal() ? 'crypto' : 'bank';
}
