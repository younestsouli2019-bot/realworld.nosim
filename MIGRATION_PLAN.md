# Migration Plan: Base44 (Local JSON) to Supabase (PostgreSQL)

## Overview
This document outlines the strategy to migrate the Autonomous Swarm's data persistence layer from local JSON files (Base44 Offline Store) to a Supabase PostgreSQL database. This ensures better scalability, real-time subscriptions, and secure remote access.

## Phase 1: Database Schema Setup
Execute the following SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Revenue Events Table
create table revenue_events (
  id text primary key,
  amount numeric not null,
  currency text default 'USD',
  status text default 'pending',
  source_system text,
  attribution_agent_id text,
  metadata jsonb,
  verification_proof jsonb,
  created_at timestamptz default now(),
  settled_at timestamptz
);

-- 2. Recipients Table
create table recipients (
  id text primary key,
  name text,
  email text,
  type text,
  payment_methods jsonb,
  status text default 'active',
  created_at timestamptz default now()
);

-- 3. Payouts Table
create table payouts (
  id text primary key,
  recipient_id text references recipients(id),
  amount numeric not null,
  currency text default 'USD',
  status text default 'scheduled',
  scheduled_date timestamptz,
  executed_at timestamptz,
  metadata jsonb
);

-- 4. Audit Log
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  action text not null,
  entity_id text,
  actor text,
  changes jsonb,
  timestamp timestamptz default now()
);
```

## Phase 2: Environment Configuration
Update your `.env` file with Supabase credentials:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
DB_ADAPTER=supabase
```

## Phase 3: Data Migration Script
Run the migration script to push local JSON data to Supabase.

```bash
node scripts/migrate-to-supabase.mjs
```

## Phase 4: Codebase Switchover
1. Modify `src/finance/AdvancedFinancialManager.mjs` to use a `DatabaseAdapter` interface.
2. Implement `SupabaseAdapter` implementing `load`, `save`, `list`.
3. Switch the `this.storage` instantiation based on `process.env.DB_ADAPTER`.

## Phase 5: Verification
1. Run `node scripts/monitor-revenue-health.mjs` (updated to query Supabase).
2. Verify row counts match JSON file counts.
