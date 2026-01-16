# Data Models

## Asset Types

| Value | Asset | Decimals |
|-------|-------|----------|
| 1 | DOT | 10 |
| 2 | KSM | 12 |
| 3 | USDT | 6 |
| 4 | USDC | 6 |
| 5 | DED | 10 |
| 0 | INVALID | - |

---

## Core Entities

### Referendum

Primary key: `id` (referendum index)

Core fields: `title`, `status`, `track`, `proposal_time`, `latest_status_change`

Value fields: `{ASSET}_proposal_time`, `{ASSET}_latest`, `USD_*`, `{ASSET}_component`

Tally fields: `tally.ayes`, `tally.nays`

Manual fields: `category_id` (FK), `notes`, `hide_in_spends`

### Treasury Spend

Primary key: `id` (spend index)

Core fields: `referendumIndex`, `status`, `description`, `proposal_time`, `latest_status_change`, `validFrom`, `expireAt`

Value fields: same pattern as Referendum

### Child Bounty

Primary key: `identifier` (string: `"{parentBountyId}_{index}"`)

Core fields: `index`, `parentBountyId`, `status`, `description`, `beneficiary`, `proposal_time`, `latest_status_change`

Value fields: `DOT`, `USD_proposal_time`, `USD_latest`

Manual fields: `category_id` (FK), `notes`, `hide_in_spends`

**Category inheritance**: Child bounties inherit parent category when `category_id` is NULL

### Fellowship Treasury Spend

Primary key: `id`

Core fields: `status`, `description`, `DOT`, `proposal_time`, `latest_status_change`

### Fellowship Salary Cycle

Primary key: `cycle`

Core fields: `budget_usdc`, `registeredCount`, `registeredPaidCount`, `registered_paid_amount_usdc`, `total_registrations_usdc`, `unregistered_paid_usdc`

Note: Fellowship salaries paid in USDC with 6 decimal places (÷ 10^6)

Period fields: `registration_period`, `payout_period`, `start_block`, `end_block`, `start_time`, `end_time`

### Fellowship Salary Claimant

Primary key: `address`

Core fields: `display_name`, `name`, `short_address`, `status_type`, `rank`, `last_active_time`

Amount fields: `registered_amount_usdc`, `attempt_amount_usdc`, `attempt_id`

Note: Fellowship salary amounts paid in USDC with 6 decimal places (÷ 10^6)

### Fellowship Salary Payment

Primary key: `payment_id` (auto-increment)

Core fields: `cycle`, `who`, `who_name`, `beneficiary`, `beneficiary_name`, `amount_dot`, `salary_dot`, `rank`, `is_active`, `block_height`, `block_time`

---

## Manual Tables

### Categories

Primary key: `id` (auto-increment)

Fields: `category`, `subcategory`

**Constraints:**
- Unique constraint: `(category, subcategory)` - no duplicate pairs allowed
- Both fields are TEXT, nullable

**Category Assignment Rules:**
- Empty category + empty subcategory (`""`, `""`) = NULL `category_id` (intentional "no category")
- Non-empty values must reference existing Categories table entries
- Foreign key references to Categories resolve to `category_id`

**Requirements:**
- Every category must have an "Other" subcategory for UI fallback selection
- All category/subcategory pairs must exist in Categories before bulk importing entities

**CSV Format:**
```
category,subcategory
Development,Infrastructure
Development,Other
```

**Import Validation:**
- Pre-validates all category references before import
- Rejects entire import (400 error) if any non-existent pairs found
- Empty pairs (`""`, `""`) skip validation (allowed)
- Error message shows first 10 violations with row numbers

### Bounties

Primary key: `id` (bounty index from chain)

Fields: `name`, `category_id` (FK), `remaining_dot`, `url`

### Subtreasury

Primary key: `id` (auto-increment)

Fields: `title`, `description`, `DOT_latest`, `USD_latest`, `*_component`, `category_id` (FK), `latest_status_change`, `url`

### Custom Spending

Primary key: `id` (auto-increment)

Fields: `type`, `title`, `description`, `latest_status_change`, `DOT_latest`, `USD_latest`, `DOT_component`, `USDC_component`, `USDT_component`, `category_id` (FK), `created_at`, `updated_at`

Type values: Must be one of: "Direct Spend", "Claim", "Bounty", "Subtreasury", "Fellowship Salary", "Fellowship Grants"

ID format in views: `custom-{id}` (e.g., custom-1, custom-2)

### Users

Primary key: `id` (auto-increment)

Fields: `username` (unique), `password_hash`, `created_at`

### Treasury Netflows

CSV-backed table for quarterly treasury flow data.

Fields: `month` (YYYY-MM), `asset_name`, `flow_type`, `amount_usd`, `amount_dot_equivalent`

Import: Full table replacement via Sync Settings

### Cross Chain Flows

CSV-backed table for cross-chain transaction tracking.

Fields: `message_hash`, `from_account`, `to_account`, `block`, `origin_event_index`, `dest_event_index`, `time`, `from_chain_id`, `destination_chain_id`, `value`, `protocol`, `status`

Import: Full table replacement via Sync Settings

### Local Flows

CSV-backed table for local transaction tracking.

Primary key: `extrinsic_id`

Fields: `date`, `block`, `hash`, `symbol`, `from_account`, `to_account`, `value`, `result`, `year_month`, `quarter`

Import: Full table replacement via Sync Settings

---

## Dashboard Tables

### Dashboard

Primary key: `id`

Fields: `name`, `description`, `created_at`, `updated_at`

### Dashboard Component

Primary key: `id`

Fields: `dashboard_id` (FK), `name`, `type`, `query_config` (JSON), `grid_config` (JSON), `chart_config` (JSON), `created_at`, `updated_at`

Component types: `table`, `pie`, `bar_stacked`, `bar_grouped`, `line`, `text`

---

## System Tables

### DataErrors

Generic error logging for data validation and insertion failures.

Primary key: `id` (autoincrement)

Fields: `table_name`, `record_id`, `error_type`, `error_message`, `raw_data` (JSON, nullable), `metadata` (JSON, nullable), `timestamp`

**Indexes**: `table_name`, (`table_name`, `record_id`), `error_type`, `timestamp`

**Usage**: Backend logs via `sink.log_data_error()`, viewable at `/manage/data-errors` (authenticated). No unique constraint - same record can appear multiple times. API: GET `/api/data-errors` (authenticated, supports filtering by `table_name` and `error_type`)

---

## Views

### outstanding_claims

Treasury spends where `status = 'Approved'` AND `expireAt > now()`

Adds: `claim_type` (active/upcoming), `days_until_expiry`, `days_until_valid`

### expired_claims

Treasury spends where `status = 'Approved'` AND `expireAt < now()`

Adds: `days_since_expiry`

### all_spending

Union of all spending types (7 sources). See `business-rules.md` for type definitions.

**Column details**:
- `year`, `year_month`, `year_quarter`: Computed from `latest_status_change`
- `category`, `subcategory`: Assignment varies by type:
  - **Direct Spend**: From Referenda's category_id
  - **Claim**: Inherited from linked Referenda via referendumIndex
  - **Bounty**: From Child Bounty's category_id, falls back to parent Bounty's category_id if NULL
  - **Subtreasury**: From Subtreasury's category_id
  - **Fellowship Salary/Grants**: Hardcoded to 'Development' / 'Polkadot Protocol & SDK'
  - **Custom Spending**: From Custom Spending's category_id

**Business logic**: `hide_in_spends` (INTEGER): When set, record is excluded from spending calculations
