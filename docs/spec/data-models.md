# Data Models

## AssetKind Enumeration

Supported asset types for value calculations:

| Value | Asset | Decimals |
|-------|-------|----------|
| 0 | INVALID | - |
| 1 | DOT | 10 |
| 2 | KSM | 12 |
| 3 | USDT | 6 |
| 4 | USDC | 6 |
| 5 | DED | 10 |

## AssetsBag

A container for holding multiple asset amounts. Used to represent the value of proposals that may contain multiple asset types.

**Properties:**
- `_assets`: Dict mapping AssetKind to amount (float)
- `_nan`: Boolean indicating if value is indeterminate

**Methods:**
- `add_asset(asset, amount)`: Add amount of asset type
- `get_amount(asset)`: Get amount for asset type (returns 0 if not present)
- `get_total_value(price_service, target_asset, date)`: Convert all assets to target currency
- `set_nan()`: Mark bag as having indeterminate value
- `is_nan()`: Check if value is indeterminate

---

## Entity Schemas

### Referendum

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Referendum index (primary key) |
| `url` | string | Link to referendum on explorer |
| `title` | string | Proposal title |
| `status` | string | Current status (Ongoing, Approved, Rejected, Executed, etc.) |
| `{ASSET}_proposal_time` | float | Value in native asset at proposal time |
| `USD_proposal_time` | float | USD value at proposal time |
| `track` | string | Governance track (SmallSpender, BigSpender, Treasurer, etc.) |
| `tally.ayes` | float | Aye votes in native tokens |
| `tally.nays` | float | Nay votes in native tokens |
| `proposal_time` | datetime | When proposal was created |
| `latest_status_change` | datetime | When status last changed |
| `{ASSET}_latest` | float | Value in native asset at latest status |
| `USD_latest` | float | USD value at latest status |
| `{ASSET}_component` | float | Native asset component of proposal |
| `USDC_component` | float | USDC component of proposal |
| `USDT_component` | float | USDT component of proposal |

### Treasury Spend

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Spend index (primary key) |
| `url` | string | Link to spend on explorer |
| `referendumIndex` | int | Associated referendum |
| `status` | string | Current status |
| `description` | string | Spend description |
| `{ASSET}_proposal_time` | float | Value at proposal time |
| `USD_proposal_time` | float | USD value at proposal time |
| `proposal_time` | datetime | Creation timestamp |
| `latest_status_change` | datetime | Last status change |
| `{ASSET}_latest` | float | Value at latest status |
| `USD_latest` | float | USD value at latest status |
| `{ASSET}_component` | float | Native asset component |
| `USDC_component` | float | USDC component |
| `USDT_component` | float | USDT component |
| `validFrom` | datetime | Block when spend becomes valid |
| `expireAt` | datetime | Block when spend expires |

### Child Bounty

| Field | Type | Description |
|-------|------|-------------|
| `identifier` | string | "{parentBountyId}_{index}" (primary key) |
| `url` | string | Link to child bounty |
| `index` | int | Child bounty index |
| `parentBountyId` | int | Parent bounty ID |
| `status` | string | Current status |
| `description` | string | Bounty description |
| `{ASSET}` | float | Bounty value in native asset |
| `USD_proposal_time` | float | USD value at proposal time |
| `beneficiary` | string | Recipient address |
| `proposal_time` | datetime | Creation timestamp |
| `latest_status_change` | datetime | Last status change |
| `USD_latest` | float | USD value at latest status |

### Fellowship Treasury Spend

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Spend index (primary key) |
| `url` | string | Link to spend |
| `status` | string | Current status |
| `description` | string | Spend description |
| `DOT` | float | Amount in DOT |
| `USD_proposal_time` | float | USD value at proposal time |
| `proposal_time` | datetime | Creation timestamp |
| `latest_status_change` | datetime | Last status change |
| `USD_latest` | float | USD value at latest status |

### Fellowship Salary Cycle

| Field | Type | Description |
|-------|------|-------------|
| `cycle` | int | Cycle number (primary key) |
| `url` | string | Link to cycle |
| `budget_dot` | float | Cycle budget in DOT |
| `registeredCount` | int | Number of registrations |
| `registeredPaidCount` | int | Number of paid registrations |
| `registered_paid_amount_dot` | float | Total paid to registered |
| `total_registrations_dot` | float | Total registration value |
| `unregistered_paid_dot` | float | Paid to unregistered |
| `registration_period` | int | Registration period in blocks |
| `payout_period` | int | Payout period in blocks |
| `start_block` | int | Cycle start block |
| `end_block` | int | Cycle end block |
| `start_time` | datetime | Cycle start time |
| `end_time` | datetime | Cycle end time |

### Fellowship Salary Claimant

| Field | Type | Description |
|-------|------|-------------|
| `address` | string | Claimant address (primary key) |
| `display_name` | string | Human-readable name or shortened address |
| `name` | string | Resolved identity name |
| `short_address` | string | Truncated address for display |
| `status_type` | string | registered, attempted, or nothing |
| `registered_amount_dot` | float | Registered amount in DOT |
| `attempt_amount_dot` | float | Attempted amount in DOT |
| `attempt_id` | int | Attempt identifier |
| `last_active_time` | datetime | Last activity timestamp |
| `rank` | int | Fellowship rank (0-7) |

---

## Database Views

### Outstanding Claims

Treasury spends that are approved, currently valid, and not yet expired. This view helps track claims that need to be processed before their expiration date.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Spend index (primary key) |
| `url` | string | Link to spend on explorer |
| `referendumIndex` | int | Associated referendum |
| `status` | string | Current status (always "Approved") |
| `description` | string | Spend description |
| `DOT_proposal_time` | float | DOT amount at proposal time |
| `USD_proposal_time` | float | USD value at proposal time |
| `DOT_latest` | float | Current DOT amount |
| `USD_latest` | float | Current USD value |
| `DOT_component` | float | DOT component of multi-token spend |
| `USDC_component` | float | USDC component |
| `USDT_component` | float | USDT component |
| `proposal_time` | datetime | Creation timestamp |
| `validFrom` | datetime | When spend became valid |
| `expireAt` | datetime | Expiration date |
| `days_until_expiry` | int | Calculated days until expiration |

**Filter Criteria:**
- `status = 'Approved'`
- `validFrom <= current_date`
- `expireAt > current_date`

**SQL Definition:**
```sql
CREATE VIEW outstanding_claims AS
SELECT
    id, url, referendumIndex, status, description,
    DOT_proposal_time, USD_proposal_time,
    DOT_latest, USD_latest,
    DOT_component, USDC_component, USDT_component,
    proposal_time, validFrom, expireAt,
    CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry
FROM Treasury
WHERE status = 'Approved'
  AND validFrom <= datetime('now')
  AND expireAt > datetime('now');
```

### Expired Claims

Treasury spends that were approved but have passed their expiration date without being claimed. This view helps track unclaimed funds that are no longer valid.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Spend index (primary key) |
| `url` | string | Link to spend on explorer |
| `referendumIndex` | int | Associated referendum |
| `status` | string | Current status (always "Approved") |
| `description` | string | Spend description |
| `DOT_proposal_time` | float | DOT amount at proposal time |
| `USD_proposal_time` | float | USD value at proposal time |
| `DOT_latest` | float | Current DOT amount |
| `USD_latest` | float | Current USD value |
| `DOT_component` | float | DOT component of multi-token spend |
| `USDC_component` | float | USDC component |
| `USDT_component` | float | USDT component |
| `proposal_time` | datetime | Creation timestamp |
| `validFrom` | datetime | When spend became valid |
| `expireAt` | datetime | Expiration date |
| `days_since_expiry` | int | Calculated days since expiration |

**Filter Criteria:**
- `status = 'Approved'`
- `expireAt < current_date`

**SQL Definition:**
```sql
CREATE VIEW expired_claims AS
SELECT
    id, url, referendumIndex, status, description,
    DOT_proposal_time, USD_proposal_time,
    DOT_latest, USD_latest,
    DOT_component, USDC_component, USDT_component,
    proposal_time, validFrom, expireAt,
    CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
FROM Treasury
WHERE status = 'Approved'
  AND expireAt < datetime('now');
```
