# Advanced Financial Manager

This module implements advanced financial operations for the Autonomous Revenue System.

## Features

### 1. Revenue Management
- **Automated Ingestion**: `manager.revenue.ingestRawRevenue(data, source)`
- **Dispute Handling**: `manager.revenue.disputeEvent(id, reason)`
- **Adjustments**: `manager.revenue.adjustEvent(id, newAmount, reason)`

### 2. Reconciliation
- **Statement Import**: `manager.reconciliation.importExternalStatement(csvData, source)`
- **Auto-Matching**: Automatically matches external transactions to internal revenue events based on Reference ID or Amount/Date.

### 3. Recurring Payouts
- **Schedule Creation**: `manager.recurring.createSchedule(recipientId, amount, currency, frequency, startDate)`
- **Auto-Processing**: `manager.recurring.processSchedules()` generates revenue events automatically.

### 4. Recipient Management
- **Centralized Database**: Store recipient details securely.
- **Methods**: `createRecipient`, `getRecipient`, `updateRecipient`.

### 5. Financial Goals & Forecasting
- **Goal Tracking**: Set revenue/profit targets and track progress in real-time.
- **Forecasting**: Simple linear regression forecast based on historical data.

### 6. Multi-Currency
- **Exchange Rates**: Fetches (mock) real-time rates.
- **Conversion**: `manager.currency.convert(amount, from, to)`

## Usage

```javascript
import { AdvancedFinancialManager } from './src/finance/AdvancedFinancialManager.mjs';

const manager = new AdvancedFinancialManager();
await manager.initialize();

// Ingest Revenue
const event = manager.revenue.ingestRawRevenue({
  amount: 1000,
  currency: 'USD',
  source: 'MissionControl'
}, 'MissionSystem');

// Check Goals
const goals = manager.goals.checkGoals();
console.log(goals);
```

## Storage
All data is persisted in `data/finance/` as JSON files.
