# Data Views Specification

Column definitions, filters, and display rules for each data view page.

## Referenda (`/referenda`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| id | link (Subsquare) | no |
| title | text (truncated) | no |
| status | badge | no |
| track | text (truncated) | no |
| DOT_proposal_time | currency | no |
| USD_proposal_time | currency | no |
| tally_ayes | number | no |
| tally_nays | number | no |
| proposal_time | date | no |
| latest_status_change | date | no |
| category | cascading-select | auth |
| subcategory | cascading-select | auth |
| notes | text | auth |
| hide_in_spends | checkbox | auth |

### Filters
- Faceted: status, track

### Default Sort
- id DESC

### Default Views
- "All": No filter
- "Spends": DOT_proposal_time > 0 AND status = "Executed"

---

## Treasury (`/treasury`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| id | number | no |
| referendumIndex | link (Subsquare) | no |
| status | badge | no |
| description | text (truncated) | no |
| DOT_proposal_time | currency | no |
| USD_proposal_time | currency | no |
| DOT_latest | currency | no |
| USD_latest | currency | no |
| DOT_component | currency | no |
| USDC_component | currency | no |
| USDT_component | currency | no |
| proposal_time | date | no |
| latest_status_change | date | no |
| validFrom | date | no |
| expireAt | date | no |

### Filters
- Faceted: status

### Default Sort
- id DESC

---

## Child Bounties (`/child-bounties`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| identifier | link (Subsquare) | no |
| parentBountyId | number | no |
| description | text (truncated) | no |
| status | badge | no |
| DOT | currency | no |
| USD_proposal_time | currency | no |
| proposal_time | date | no |
| latest_status_change | date | no |
| category | cascading-select | auth |
| subcategory | cascading-select | auth |
| parentCategory | text (placeholder) | no |
| parentSubcategory | text (placeholder) | no |
| notes | text | auth |
| hide_in_spends | checkbox | auth |
| parentBountyName | text | no |

### Filters
- Faceted: status, parentBountyId, category, subcategory

### Default Sort
- identifier DESC

### Notes
- Uses `identifier` (string) as primary key, not `id`
- Parent category shown as grayed placeholder when no override set

---

## Fellowship (`/fellowship`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| id | link (Subsquare fellowship) | no |
| description | text (truncated) | no |
| status | badge | no |
| DOT | currency | no |
| USD_proposal_time | currency | no |
| proposal_time | date | no |
| latest_status_change | date | no |
| USD_latest | currency | no |

### Filters
- Faceted: status

### Default Sort
- id DESC

---

## Spending (`/spending`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| latest_status_change | date | no |
| type | badge | no |
| title | text | no |
| DOT_latest | currency | no |
| USD_latest | currency | no |
| category | text | no |
| subcategory | text | no |
| DOT_component | currency | no |
| USDC_component | currency | no |
| USDT_component | currency | no |
| id | link (type-aware) | no |

### Filters
- Faceted: type, category

### Type Badge Values
- Direct Spend, Claim, Bounty, Subtreasury, Fellowship Salary, Fellowship Grants

### Access
- Requires authentication to view

---

## Outstanding Claims (`/outstanding-claims`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| validFrom | date | no |
| DOT_component | currency | no |
| USDT_component | currency | no |
| USDC_component | currency | no |
| id | link (Subsquare) | no |
| referendumIndex | link (Subsquare) | no |
| description | text | no |
| expireAt | date | no |
| latest_status_change | date | no |
| days_until_expiry | badge (color-coded) | no |

### Expiry Badge Colors
| Condition | Variant |
|-----------|---------|
| <= 7 days | destructive (red) |
| <= 30 days | warning (yellow) |
| > 30 days | success (green) |

### Default Sort
- days_until_expiry ASC

---

## Expired Claims (`/expired-claims`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| validFrom | date | no |
| DOT_component | currency | no |
| USDT_component | currency | no |
| USDC_component | currency | no |
| id | link (Subsquare) | no |
| referendumIndex | link (Subsquare) | no |
| description | text | no |
| expireAt | date | no |
| latest_status_change | date | no |
| days_since_expiry | badge (color-coded) | no |

### Age Badge Colors
| Condition | Variant |
|-----------|---------|
| <= 7 days | warning |
| <= 30 days | secondary |
| > 30 days | destructive |

### Default Sort
- days_since_expiry DESC

---

## Treasury Netflows (`/treasury-netflows`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| month | date | no |
| asset_name | text | no |
| flow_type | text | no |
| amount_usd | currency (+/- sign) | no |
| amount_dot_equivalent | currency (+/- sign) | no |

### Default Sort
- month DESC

---

## Fellowship Salary Cycles (`/fellowship-salary-cycles`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| cycle | link (Subsquare salary cycle) | no |
| start_time | date | no |
| end_time | date | no |
| total_registrations_usdc | currency | no |
| registered_paid_amount_usdc | currency | no |
| unregistered_paid_usdc | currency | no |
| registeredCount | number | no |
| registeredPaidCount | number | no |
| budget_usdc | currency | no |

### Default Sort
- cycle DESC

---

## Fellowship Salary Claimants (`/fellowship-salary-claimants`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| display_name | text | no |
| address | address (truncated) | no |
| rank | text (mapped) | no |
| status_type | badge | no |
| registered_amount_usdc | currency | no |
| attempt_amount_usdc | currency | no |
| attempt_id | number | no |
| last_active_time | date | no |

### Rank Display Mapping
| Value | Display |
|-------|---------|
| 0 | Candidate |
| 1 | Member I |
| 2 | Member II |
| 3 | Member III |
| 4 | Architect I |
| 5 | Architect II |
| 6 | Fellow |
| 7 | Master |

### Status Badge Colors
| Status | Variant |
|--------|---------|
| Registered | success (green) |
| Attempted | warning (yellow) |
| Nothing | secondary (gray) |

### Filters
- Faceted: status_type

### Default Sort
- display_name ASC

### Address Truncation
- First 8 + last 6 characters

---

## Fellowship Salary Payments (`/fellowship-salary-payments`)

### Columns

| Column | Type | Editable |
|--------|------|----------|
| payment_id | number | no |
| cycle | link (Subsquare salary cycle) | no |
| who_name | text | no |
| amount_usdc | currency | no |
| amount_dot | currency | no |
| salary_usdc | currency | no |
| rank | number | no |
| block_time | date | no |

### Default Sort
- block_time DESC

---

## External Link Patterns

| Entity | URL Pattern |
|--------|-------------|
| Referendum ID | Subsquare referendum page |
| Child Bounty identifier | Subsquare child bounty page |
| Fellowship ID | Subsquare fellowship page |
| Salary cycle | Subsquare salary cycle page |

---

## Authentication Model

| Page | View Access | Edit Access |
|------|-------------|-------------|
| Referenda | Public | Authenticated |
| Treasury | Public | None |
| Child Bounties | Public | Authenticated |
| Fellowship | Public | None |
| Spending | Authenticated | None |
| Outstanding Claims | Public | None |
| Expired Claims | Public | None |
| Treasury Netflows | Public | None |
| Salary Cycles | Public | None |
| Salary Claimants | Public | None |
| Salary Payments | Public | None |
