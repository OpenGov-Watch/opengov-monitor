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

**Category inheritance**: When `category_id` is NULL, UI displays parent bounty's category as grayed placeholder. User can override by selecting category or inherit by selecting "None".

### Fellowship Treasury Spend

Primary key: `id`

Core fields: `status`, `description`, `DOT`, `proposal_time`, `latest_status_change`

### Fellowship Salary Cycle

Primary key: `cycle`

Core fields: `budget_usdc`, `registeredCount`, `registeredPaidCount`, `registered_paid_amount_usdc`, `total_registrations_usdc`, `unregistered_paid_usdc`

Note: Fellowship salaries are paid in USDC with 6 decimal places (÷ 10^6)

Period fields: `registration_period`, `payout_period`, `start_block`, `end_block`, `start_time`, `end_time`

### Fellowship Salary Claimant

Primary key: `address`

Core fields: `display_name`, `name`, `short_address`, `status_type`, `rank`, `last_active_time`

Amount fields: `registered_amount_usdc`, `attempt_amount_usdc`, `attempt_id`

Note: Fellowship salary amounts are paid in USDC with 6 decimal places (÷ 10^6)

### Fellowship Salary Payment

Primary key: `payment_id` (auto-increment)

Core fields: `cycle`, `who`, `who_name`, `beneficiary`, `beneficiary_name`, `amount_dot`, `salary_dot`, `rank`, `is_active`, `block_height`, `block_time`

---

## Manual Tables

### Categories

Primary key: `id` (auto-increment)

Fields: `category`, `subcategory`

Unique constraint: (category, subcategory)

**Requirement**: Every category must have an "Other" subcategory for fallback scenarios in UI selection logic.

**Bulk Import**: Import unique category/subcategory pairs via Sync Settings (`/manage/sync`):
- **Default file**: `data/defaults/categories.csv` - 81 unique pairs aggregated from bounties, child bounties, and referenda
- **CSV format**: `category,subcategory`
- **Import logic**: Uses `INSERT OR IGNORE` to prevent duplicates on re-import
- **API endpoints**:
  - GET `/api/sync/defaults/categories` - Retrieve default categories CSV
  - POST `/api/categories/import` - Bulk insert (authenticated)
- **Frontend**: First card in sync settings grid with "Upload CSV" and "Apply Defaults" buttons

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

Generic error logging table for data validation and insertion failures across all tables.

Primary key: `id` (autoincrement)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | NOT NULL | Auto-incrementing error ID |
| `table_name` | TEXT | NOT NULL | Which table the error occurred for (e.g., "Treasury", "Referenda") |
| `record_id` | TEXT | NOT NULL | ID of the record that failed (stored as TEXT for flexibility) |
| `error_type` | TEXT | NOT NULL | Error category (e.g., "missing_value", "invalid_asset", "price_conversion_failed") |
| `error_message` | TEXT | NOT NULL | Specific error details |
| `raw_data` | TEXT | NULL | Full JSON from source API (optional, may be NULL for historical errors) |
| `metadata` | TEXT | NULL | Additional context as JSON (e.g., status, description, null_columns) |
| `timestamp` | TIMESTAMP | NOT NULL | When the error occurred |

**Indexes:**
- `idx_data_errors_table` on (`table_name`)
- `idx_data_errors_record` on (`table_name`, `record_id`)
- `idx_data_errors_type` on (`error_type`)
- `idx_data_errors_timestamp` on (`timestamp`)

**Usage:**
- Backend validation logs errors via `sink.log_data_error()`
- Errors viewable in `/manage/data-errors` page (authentication required)
- No unique constraint - same record can appear multiple times with different timestamps
- API endpoint: `GET /api/data-errors` (authenticated, supports filtering by `table_name` and `error_type`)

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

**Column details:**
- `year`, `year_month`, `year_quarter`: Computed date grouping columns from `latest_status_change`
- `category`, `subcategory`: Assignment varies by type:
  - **Direct Spend**: From Referenda's category_id (via Categories table)
  - **Claim**: Inherited from linked Referenda via referendumIndex (Treasury has no category_id field)
  - **Bounty**: From Child Bounty's category_id, falls back to parent Bounty's category_id if NULL
  - **Subtreasury**: From Subtreasury's category_id
  - **Fellowship Salary/Grants**: Hardcoded to 'Development' / 'Polkadot Protocol & SDK'
  - **Custom Spending**: From Custom Spending's category_id

**Business logic:**
- `hide_in_spends` flag: Direct Spend and Bounty types exclude records where `hide_in_spends = 1`
