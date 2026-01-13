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

---

## Table View System

### Advanced Filter Types

Advanced filters allow Notion-like complex filtering with AND/OR combinations.

#### FilterOperator

Supported operators:
- Comparison: `=`, `!=`, `>`, `<`, `>=`, `<=`
- Pattern matching: `LIKE`, `NOT LIKE`
- List operations: `IN`, `NOT IN`
- Null checks: `IS NULL`, `IS NOT NULL`
- Range: `BETWEEN`

#### AdvancedFilterCondition

Individual filter condition:
- `column`: Column name to filter on
- `operator`: FilterOperator
- `value`: Filter value (type depends on operator)
  - Single value: string | number
  - Array: string[] (for IN/NOT IN)
  - Range: [number, number] | [string, string] (for BETWEEN)
  - Null: null (for IS NULL/IS NOT NULL)

#### AdvancedFilterGroup

Group of conditions combined with AND/OR:
- `combinator`: "AND" | "OR"
- `conditions`: Array of AdvancedFilterCondition or nested AdvancedFilterGroup

**Nesting:** Filter groups can be nested up to 10 levels deep for complex logic.

**Example:**
```json
{
  "combinator": "AND",
  "conditions": [
    { "column": "status", "operator": "=", "value": "Executed" },
    {
      "combinator": "OR",
      "conditions": [
        { "column": "DOT_latest", "operator": ">", "value": 10000 },
        { "column": "category", "operator": "IN", "value": ["Infrastructure", "Marketing"] }
      ]
    }
  ]
}
```

### Multi-Column Sorting

#### SortCondition

- `column`: Column name to sort by
- `direction`: "ASC" | "DESC"

**Multi-sort:** Array of SortCondition applies sorting in order (primary sort first).

**Example:**
```json
[
  { "column": "status", "direction": "ASC" },
  { "column": "DOT_latest", "direction": "DESC" }
]
```

### Grouping Configuration

#### GroupConfig

- `column`: Column to group by
- `aggregations`: Optional array of aggregation functions
  - `column`: Column to aggregate
  - `function`: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"
  - `alias`: Display name for aggregated column

**Example:**
```json
{
  "column": "category",
  "aggregations": [
    { "column": "*", "function": "COUNT", "alias": "count" },
    { "column": "DOT_latest", "function": "SUM", "alias": "total_dot" }
  ]
}
```

### Table View State

Saved view configuration:
- `name`: View name
- `filters`: AdvancedFilterGroup (optional)
- `sorts`: SortCondition[] (optional)
- `grouping`: GroupConfig (optional)
- `columnVisibility`: Record<string, boolean> (optional)
- `pagination`: { pageIndex, pageSize } (optional)

### API Query Parameters

Tables support these query parameters:
- `filters`: JSON-encoded AdvancedFilterGroup
- `sorts`: JSON-encoded SortCondition[]
- `groupBy`: Column name to group by
- `limit`: Max rows to return (capped at 10,000)
- `offset`: Number of rows to skip

**Backward Compatibility:** All endpoints work without these parameters (returns all data).
