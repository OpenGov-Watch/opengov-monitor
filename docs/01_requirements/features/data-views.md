# Data Views Requirements

Requirements for public data exploration pages.

## Overview

Must provide 11 public data view pages for exploring Polkadot governance data. All pages use the DataTable component with page-specific configurations.

## Referenda Page (`/referenda`)

Browse and categorize referendum proposals with spending tracking.

**User Capabilities:**
- View referendum details with spending values
- Filter by status and track
- Edit categories, notes, visibility (authenticated)

**Data Source:** `Referenda` with LEFT JOIN to `Categories`

---

## Treasury Page (`/treasury`)

View treasury spend proposals and their execution status.

**User Capabilities:**
- View treasury spend details with component breakdown (DOT, USDC, USDT)
- Filter by status

**Data Source:** `Treasury`

---

## Child Bounties Page (`/child-bounties`)

Track child bounty claims with parent bounty inheritance.

**User Capabilities:**
- View child bounty details with parent bounty information
- See inherited category from parent bounty when no override set
- Filter by status, parent bounty, category
- Edit categories, notes, visibility (authenticated)

**Data Source:** `Child Bounties` with LEFT JOINs to `Categories` (child + parent), `Bounties`

---

## Fellowship Page (`/fellowship`)

View Fellowship treasury proposals.

**User Capabilities:**
- View Fellowship proposal details
- Filter by status

**Data Source:** `Fellowship`

---

## Spending Page (`/spending`)

Unified view of all spending across sources.

**User Capabilities:**
- View aggregated spending from all sources
- Filter by type and category
- Navigate to source records via type-aware links

**Data Source:** `all_spending` view

**Access:** Requires authentication to view

---

## Outstanding Claims Page (`/outstanding-claims`)

Track treasury claims pending execution with expiry warnings.

**User Capabilities:**
- View pending claims with expiry information
- See color-coded expiry urgency indicators
- Navigate to related referendum

**Data Source:** `outstanding_claims` view

---

## Expired Claims Page (`/expired-claims`)

View claims that have passed their expiry date.

**User Capabilities:**
- View expired claims with age information
- See color-coded age indicators
- Navigate to related referendum

**Data Source:** `expired_claims` view

---

## Treasury Netflows Page (`/treasury-netflows`)

Track treasury inflows and outflows by month and asset.

**User Capabilities:**
- View monthly flow data by asset type
- See formatted currency with +/- signs

**Data Source:** `Treasury Netflows`

---

## Fellowship Salary Cycles Page (`/fellowship-salary-cycles`)

View Fellowship salary cycle aggregates.

**User Capabilities:**
- View salary cycle summary with registration and payment metrics
- Navigate to Subsquare salary cycle page

**Data Source:** `Fellowship Salary Cycles`

---

## Fellowship Salary Claimants Page (`/fellowship-salary-claimants`)

Current snapshot of Fellowship salary claimants.

**User Capabilities:**
- View claimant details with rank and status
- Filter by status type

**Data Source:** `Fellowship Salary Claimants`

---

## Fellowship Salary Payments Page (`/fellowship-salary-payments`)

Individual Fellowship salary payment records.

**User Capabilities:**
- View payment details with dual currency display (USDC and DOT)
- Navigate to salary cycle page

**Data Source:** `Fellowship Salary Payments`

---

## Common Patterns

### Authentication Model

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

### Editable Field Pattern

Pages with editing support use consistent fields: category/subcategory, notes, hide_in_spends.

## See Also

- [Data Views Specification](../../02_specification/frontend/data-views.md) - Column lists, filter columns, sort orders, badge colors
- [DataTable Requirements](../frontend/data-table.md)
- [Filtering Systems](../frontend/filters.md)
