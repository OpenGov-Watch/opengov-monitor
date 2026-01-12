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

### Fellowship Treasury Spend

Primary key: `id`

Core fields: `status`, `description`, `DOT`, `proposal_time`, `latest_status_change`

### Fellowship Salary Cycle

Primary key: `cycle`

Core fields: `budget_dot`, `registeredCount`, `registeredPaidCount`, `registered_paid_amount_dot`, `total_registrations_dot`, `unregistered_paid_dot`

Period fields: `registration_period`, `payout_period`, `start_block`, `end_block`, `start_time`, `end_time`

### Fellowship Salary Claimant

Primary key: `address`

Core fields: `display_name`, `name`, `short_address`, `status_type`, `rank`, `last_active_time`

Amount fields: `registered_amount_dot`, `attempt_amount_dot`, `attempt_id`

### Fellowship Salary Payment

Primary key: `payment_id` (auto-increment)

Core fields: `cycle`, `who`, `who_name`, `beneficiary`, `beneficiary_name`, `amount_dot`, `salary_dot`, `rank`, `is_active`, `block_height`, `block_time`

---

## Manual Tables

### Categories

Primary key: `id` (auto-increment)

Fields: `category`, `subcategory`

Unique constraint: (category, subcategory)

### Bounties

Primary key: `id` (bounty index from chain)

Fields: `name`, `category_id` (FK), `remaining_dot`, `url`

### Subtreasury

Primary key: `id` (auto-increment)

Fields: `title`, `description`, `DOT_latest`, `USD_latest`, `*_component`, `category_id` (FK), `latest_status_change`, `url`

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

## Views

### outstanding_claims

Treasury spends where `status = 'Approved'` AND `expireAt > now()`

Adds: `claim_type` (active/upcoming), `days_until_expiry`, `days_until_valid`

### expired_claims

Treasury spends where `status = 'Approved'` AND `expireAt < now()`

Adds: `days_since_expiry`

### all_spending

Union of all spending types. See `business-rules.md` for type definitions.

**Note:** View has schema issues; API uses custom query instead.
