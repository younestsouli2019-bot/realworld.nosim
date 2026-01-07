export const PrivacyMasker = {
  maskIBAN(iban) {
    const s = String(iban || '');
    if (!s || s.length < 8) return s ? '****' : null;
    return `${s.slice(0, 4)}****${s.slice(-4)}`;
  },
  maskCryptoAddress(address) {
    const s = String(address || '');
    if (!s || s.length < 12) return s ? '****' : null;
    return `${s.slice(0, 6)}****${s.slice(-6)}`;
  },
  maskPayoneerId(id) {
    const s = String(id || '');
    if (!s) return null;
    const tail = s.slice(-4);
    return `P****${tail}`;
  },
  maskEmail(email) {
    const s = String(email || '');
    if (!s || !s.includes('@')) return s ? '****' : null;
    const [user, domain] = s.split('@');
    const u = user.length <= 3 ? user[0] || '*' : user.slice(0, 3);
    return `${u}****@${domain}`;
  },
  maskUnknown(identifier) {
    const s = String(identifier || '');
    if (!s) return null;
    return s.length <= 6 ? '****' : `${s.slice(0, 3)}****${s.slice(-3)}`;
  },
  reassurance(routeType) {
    return `Discreet privacy enforced for ${routeType}; secure payment guaranteed via OWNER settlement rules`;
  },
  maskByType(type, identifier) {
    const t = String(type || '').toLowerCase();
    if (t === 'bank' || t.includes('iban') || t.includes('rib')) return this.maskIBAN(identifier);
    if (t === 'crypto' || t.includes('erc20') || t.includes('ton') || t.includes('bep20')) return this.maskCryptoAddress(identifier);
    if (t === 'payoneer') return this.maskPayoneerId(identifier);
    if (t === 'paypal' || (identifier || '').includes('@')) return this.maskEmail(identifier);
    return this.maskUnknown(identifier);
  }
};

