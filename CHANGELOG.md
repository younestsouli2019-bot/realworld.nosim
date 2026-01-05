# Changelog

## 2026-01-05
- Added on-chain verification support in ProofValidator via ChainVerifier (USDT on BSC).
- Integrated 72h Settlement SLA auto-fail pre-check in OwnerSettlementEnforcer.
- Enhanced owner settlement enforcement to queue on Bunker Mode or missing credentials and approve only after proof validation.
- Added Payoneer primary bank destinations:
  - UK: Barclays (Sort code 231486, Account 15924956)
  - Japan: MUFG (Bank code 0005, Branch 869, Account 4671926)
  - EU: Banking Circle (IBAN LU774080000041265646, BIC BCIRLULL)
- Updated owner allowlist to include Payoneer bank references.
- Tests added for SLA enforcement and owner settlement verification paths.
