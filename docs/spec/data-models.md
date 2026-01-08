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
| `category` | string | Spending category (nullable, manually assigned) |
| `subcategory` | string | Spending subcategory (nullable, manually assigned) |
| `notes` | string | User notes for this referendum (nullable) |
| `hide_in_spends` | int | 1 to hide from spending reports, 0 or null to show |

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
| `category` | string | Spending category (nullable, manually assigned or inherited from parent bounty) |
| `subcategory` | string | Spending subcategory (nullable, manually assigned or inherited from parent bounty) |
| `notes` | string | User notes for this child bounty (nullable) |
| `hide_in_spends` | int | 1 to hide from spending reports, 0 or null to show |

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

### Fellowship Salary Payment

Individual payment events from fellowship salary cycles. Populated from the `/fellowship/salary/cycles/{cycle}/feeds` endpoint, filtered for `event: "Paid"`.

| Field | Type | Description |
|-------|------|-------------|
| `payment_id` | int | Auto-incrementing payment ID (primary key) |
| `cycle` | int | Salary cycle number |
| `who` | string | Address of the fellowship member |
| `who_name` | string | Resolved identity name for `who` |
| `beneficiary` | string | Address receiving the payment |
| `beneficiary_name` | string | Resolved identity name for `beneficiary` |
| `amount_dot` | float | Total payment amount in DOT |
| `salary_dot` | float | Base salary amount in DOT |
| `rank` | int | Fellowship rank at time of payment |
| `is_active` | int | Whether member is active (1) or passive (0) |
| `block_height` | int | Block number of the payment |
| `block_time` | datetime | Timestamp of the payment |
| `url` | string | Link to payment on explorer |

**Note:** The `blockTime` from the API is in **milliseconds** (not seconds like other endpoints).

---

## Database Views

### Outstanding Claims

Treasury spends that are approved and not yet expired. Includes both **active** claims (already valid) and **upcoming** claims (not yet valid). This view helps track all claims that need to be processed before their expiration date.

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
| `latest_status_change` | datetime | Last status change |
| `validFrom` | datetime | When spend becomes/became valid |
| `expireAt` | datetime | Expiration date |
| `claim_type` | string | "active" if validFrom <= now, "upcoming" otherwise |
| `days_until_expiry` | int | Calculated days until expiration |
| `days_until_valid` | int | Calculated days until validFrom (negative if already valid) |

**Filter Criteria:**
- `status = 'Approved'`
- `expireAt > current_date`

**SQL Definition:**
```sql
CREATE VIEW outstanding_claims AS
SELECT
    id, url, referendumIndex, status, description,
    DOT_proposal_time, USD_proposal_time,
    DOT_latest, USD_latest,
    DOT_component, USDC_component, USDT_component,
    proposal_time, latest_status_change, validFrom, expireAt,
    CASE WHEN validFrom <= datetime('now') THEN 'active' ELSE 'upcoming' END AS claim_type,
    CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry,
    CAST((julianday(validFrom) - julianday('now')) AS INTEGER) AS days_until_valid
FROM Treasury
WHERE status = 'Approved'
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
| `latest_status_change` | datetime | Last status change |
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
    proposal_time, latest_status_change, validFrom, expireAt,
    CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
FROM Treasury
WHERE status = 'Approved'
  AND expireAt < datetime('now');
```

### All Spending

Aggregated view of all spending across multiple sources. Used for unified spending analytics.

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Spending type: Direct Spend, Claim, Bounty, Subtreasury, Fellowship Salary, Fellowship Grants |
| `id` | string | Unique identifier with type prefix (e.g., "ref-123", "treasury-456") |
| `latest_status_change` | datetime | When status last changed |
| `DOT_latest` | float | DOT amount |
| `USD_latest` | float | USD value |
| `category` | string | Spending category |
| `subcategory` | string | Spending subcategory |
| `title` | string | Spending title/description |
| `DOT_component` | float | DOT component |
| `USDC_component` | float | USDC component |
| `USDT_component` | float | USDT component |
| `url` | string | Link to source |

**Spending Types:**
- **Direct Spend**: Referenda with `status = 'Executed'` and `DOT_latest > 0`, with no linked Treasury record
- **Claim**: Treasury spends with `status IN ('Paid', 'Processed')`
- **Bounty**: Child bounties with `status = 'Claimed'`
- **Subtreasury**: Manually managed spending entries
- **Fellowship Salary**: Completed fellowship salary cycles
- **Fellowship Grants**: Fellowship treasury spends with `status IN ('Paid', 'Approved')`

---

## Manual Tables

These tables are managed via the frontend UI rather than populated from external APIs.

### Categories

Predefined category/subcategory pairs for classifying spending.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Auto-incrementing ID (primary key) |
| `category` | string | Category name |
| `subcategory` | string | Subcategory name |

**Unique constraint:** (category, subcategory) pair must be unique.

### Bounties

Parent bounty records for category inheritance by child bounties. Bounty data is fetched from Subsquare API, but category assignment is manual.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Bounty index from chain (primary key) |
| `name` | string | Bounty name/title |
| `category` | string | Assigned category |
| `subcategory` | string | Assigned subcategory |
| `remaining_dot` | float | Remaining bounty funds in DOT |
| `url` | string | Link to bounty on explorer |

### Subtreasury

Manually tracked spending that doesn't fit other categories.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Auto-incrementing ID (primary key) |
| `title` | string | Spending title |
| `description` | string | Detailed description |
| `DOT_latest` | float | DOT amount |
| `USD_latest` | float | USD value |
| `DOT_component` | float | DOT component |
| `USDC_component` | float | USDC component |
| `USDT_component` | float | USDT component |
| `category` | string | Spending category |
| `subcategory` | string | Spending subcategory |
| `latest_status_change` | datetime | Last update timestamp |
| `url` | string | Link to related resource |

---

## Dashboard Tables

These tables support the custom dashboard feature.

### Dashboard

User-created dashboard definitions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Auto-incrementing ID (primary key) |
| `name` | string | Dashboard name |
| `description` | string | Optional description |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |

### Dashboard Component

Individual components (charts, tables) within a dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Auto-incrementing ID (primary key) |
| `dashboard_id` | int | Parent dashboard ID (foreign key) |
| `name` | string | Component name/title |
| `type` | string | Component type: table, pie, bar_stacked, bar_grouped, line |
| `query_config` | string | JSON blob storing query builder configuration |
| `grid_config` | string | JSON blob storing grid position: { x, y, w, h } |
| `chart_config` | string | JSON blob storing chart-specific options (nullable) |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update timestamp |

**Index:** `idx_dashboard_components_dashboard` on `dashboard_id`

### Query Config Structure

The `query_config` JSON has the following structure:

```typescript
interface QueryConfig {
  sourceTable: string;                   // Table or view name
  columns: ColumnSelection[];            // Selected columns
  expressionColumns?: ExpressionColumn[]; // User-defined calculated columns
  filters: FilterCondition[];            // Filter conditions
  groupBy?: string[];                    // Columns to group by
  orderBy?: OrderByConfig[];             // Sort order
  limit?: number;                        // Row limit (max 10,000)
}

interface ColumnSelection {
  column: string;
  alias?: string;
  aggregateFunction?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
}

interface ExpressionColumn {
  expression: string;  // SQL expression, e.g., "ROUND(DOT_latest / 1000000, 2)"
  alias: string;       // Required display name for the result column
}

interface FilterCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value: string | number | string[] | null;
}

interface OrderByConfig {
  column: string;
  direction: "ASC" | "DESC";
}
```

**Expression Column Examples:**
- Arithmetic: `DOT_latest * 10`
- Rounding: `ROUND(DOT_latest / 1000000, 2)`
- Conditional: `CASE WHEN status = 'Executed' THEN 1 ELSE 0 END`
- Null handling: `COALESCE(DOT_latest, 0) / NULLIF(USD_latest, 0)`
- String functions: `UPPER(status)`

### Chart Config Structure

The `chart_config` JSON stores chart-specific options:

```typescript
interface ChartConfig {
  colors?: string[];      // Custom color palette
  labelColumn?: string;   // Column for chart labels/categories
  valueColumn?: string;   // Column for chart values (pie chart)
  showLegend?: boolean;   // Show/hide legend
  showTooltip?: boolean;  // Show/hide tooltips
}
```
