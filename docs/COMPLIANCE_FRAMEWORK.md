# Legal & Compliance Framework

## Overview
This system operates under strict automated compliance rules to adhere to financial regulations and data privacy standards.

## Financial Compliance

### KYC (Know Your Customer)
- **Identity**: System is hard-bound to a single verified identity (Younes Tsouli).
- **Intervention**: If a PSP requests new KYC, agents pause and export `exports/kyc-requests/`.

### AML (Anti-Money Laundering)
- **Source Verification**: All revenue is traced to specific Agent Activities.
- **Destination Lock**: Funds only flow to verified Owner Accounts.
- **Thresholds**: Transactions >$2k are flagged for higher scrutiny (Bucket B).

### Tax Reporting
- **Revenue Tracking**: `SettlementLedger` records 100% of income.
- **Reporting**: Data is structured to support 1099/Tax Return generation.

## Data Privacy (GDPR/CCPA)

### Data Minimization
- System only stores data necessary for transaction processing.
- No customer PII is stored permanently (transient processing for abandoned carts).

### Data Retention
- **Financial Records**: 7 Years (Legal Requirement).
- **Operational Logs**: 90 Days.
- **Transient Data**: Deleted after processing.

## Acceptable Use
- **Prohibited**: Illegal goods, High-risk financial speculation, deceptive marketing.
- **Enforcement**: `ProductSelectionEngine` filters out non-compliant niches.
