export const Platforms = [
  { id: 'paymentvision', name: 'PaymentVision', capabilities: ['ACH', 'CARD'], verticals: ['collections', 'auto_finance'] },
  { id: 'paynearme', name: 'PayNearMe', capabilities: ['CASH', 'ACH', 'CARD', 'MOBILE_WALLET'], verticals: ['collections', 'billing'] },
  { id: 'billingtree', name: 'BillingTree', capabilities: ['ACH', 'CARD'], verticals: ['healthcare', 'arm', 'credit_union'] },
  { id: 'pdcflow', name: 'PDCflow', capabilities: ['COMMUNICATION', 'SMS', 'EMAIL', 'SIGNATURE'], verticals: ['billing'] },
  { id: 'paywire', name: 'Paywire', capabilities: ['CARD', 'ACH'], verticals: ['gateway'] },
  { id: 'trattaflow', name: 'TrattaFlow', capabilities: ['WORKFLOWS', 'COLLECTIONS'], verticals: ['debt_recovery'] },
  { id: 'paynseconds', name: 'PayNSeconds', capabilities: ['CARD', 'ACH'], verticals: ['gateway'] },
  { id: 'revspringflow', name: 'RevSpringFlow', capabilities: ['BILLING', 'PAYMENTS', 'COMMUNICATION'], verticals: ['engagement'] },
  { id: 'repay', name: 'Repay', capabilities: ['OMNICHANNEL', 'LOAN', 'B2B'], verticals: ['repayments'] },
  { id: 'usaePay', name: 'USAePay', capabilities: ['CARD', 'CHECK'], verticals: ['gateway'] },
  { id: 'intellipay', name: 'Intellipay', capabilities: ['CARD', 'ACH', 'FEE_OPTIONS'], verticals: ['cloud'] },
  { id: 'tsys', name: 'TSYS', capabilities: ['CARD_NETWORK'], verticals: ['merchant_acceptance'] },
  { id: 'uownleasing', name: 'UOwnLeasing', capabilities: ['LEASE_TO_OWN'], verticals: ['checkout'] },
  { id: 'nuvei', name: 'Nuvei', capabilities: ['GLOBAL', 'MULTI_METHOD', 'MULTI_CURRENCY'], verticals: ['gateway'] },
  { id: 'paymentus', name: 'PaymentUs', capabilities: ['EBPP', 'BILLING'], verticals: ['consumer', 'utility'] },
  { id: 'professionalcredit', name: 'ProfessionalCredit', capabilities: ['COLLECTIONS'], verticals: ['services'] },
  { id: 'paymentpros', name: 'PaymentPros', capabilities: ['POS', 'ONLINE'], verticals: ['custom_processing'] },
  { id: 'cssimpact', name: 'CSSImpact', capabilities: ['COLLECTIONS', 'DEBT_MGMT', 'DIALERS', 'DIGITAL_BILLING'], verticals: ['end_to_end'] },
  { id: 'cardpointe', name: 'CardPointe', capabilities: ['MANAGEMENT', 'REPORTING', 'TERMINALS'], verticals: ['card'] },
  { id: 'swervepay', name: 'SwervePay', capabilities: ['HEALTHCARE', 'TEXT_COLLECTION'], verticals: ['healthcare'] }
];

export function getPlatform(id) {
  const key = String(id || '').toLowerCase();
  return Platforms.find(p => p.id.toLowerCase() === key) || null;
}

export function listPlatforms() {
  return Platforms.slice();
}

export function listByCapability(cap) {
  const c = String(cap || '').toUpperCase();
  return Platforms.filter(p => Array.isArray(p.capabilities) && p.capabilities.includes(c));
}

