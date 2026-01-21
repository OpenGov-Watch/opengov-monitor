# Import System

Bulk import architecture for categories, referenda, bounties, child-bounties, treasury netflows, and flow data.

## Overview

```
Frontend                              API                              Database
────────                              ───                              ────────
                     ┌── Upload CSV ──┐
CSV Parser ──────────┤                ├──▶ POST /api/{entity}/import
                     └─ Apply Defaults┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │   Pre-validation    │
                  │ (category lookup)   │
                  └─────────────────────┘
                            │
                  Pass ─────┼───── Fail
                    │               │
                    ▼               ▼
              ┌───────────┐   ┌───────────┐
              │Transaction│   │ 400 Error │
              │(all rows) │   │(violations)│
              └───────────┘   └───────────┘
```

## Design Decisions

### Dual-Mode Category Specification

Import items support two ways to specify categories:

**Option A: Direct `category_id`**
- Pass integer ID directly
- Used by programmatic imports

**Option B: String lookup**
- Pass `category` and `subcategory` strings
- Backend looks up existing category ID
- Does NOT auto-create categories (unlike `/api/categories/lookup`)

Implementation: [src/api/src/db/queries.ts:bulkUpdateReferenda](../../../src/api/src/db/queries.ts)

### Pre-Validation Architecture

All imports validate **before** starting the database transaction:

1. Iterate all rows checking category references
2. Collect violations (category/subcategory pairs not in Categories table)
3. If any violations: reject entire import with 400 error
4. If validation passes: execute transaction

This ensures atomic imports - either all rows succeed or none change.

Special case: Empty strings for both `category` and `subcategory` (`""`, `""`) means "no category" - sets `category_id = NULL`.

### Transaction Handling

Uses SQLite transactions via better-sqlite3's `db.transaction()`:
- All rows updated in single transaction
- Automatic rollback on any error
- Guarantees all-or-nothing semantics

### Identifier Normalization

Child bounty identifiers use different separators:
- CSV files: hyphen (`33-1193`)
- Database: underscore (`33_1193`)

Backend normalizes on import: `identifier.replace(/-/g, '_')`

Implementation: [src/api/src/db/queries.ts:bulkUpdateChildBounties](../../../src/api/src/db/queries.ts)

### Error Response Design

Validation errors return HTTP 400 with first 10 violations:

```
Import rejected: 3 row(s) reference non-existent categories.
First 10 violations:
  Row 165: referendum 352 → category="", subcategory="PBA"
  Row 200: referendum 400 → category="InvalidCat", subcategory="Infra"
```

Row numbers account for header row (+1) and 0-indexing (+1).

## Import Types

| Entity | Endpoint | Identifier | Updates |
|--------|----------|------------|---------|
| Categories | `POST /api/categories/import` | category+subcategory | INSERT OR IGNORE |
| Referenda | `POST /api/referenda/import` | `id` (integer) | category_id, notes, hide_in_spends |
| Bounties | `POST /api/bounties/import` | `id` (integer) | category_id |
| Child Bounties | `POST /api/child-bounties/import` | `identifier` (string) | category_id, notes, hide_in_spends |
| Treasury Netflows | `POST /api/treasury-netflows/import` | month+asset_name+flow_type | amount fields |
| Cross-Chain Flows | `POST /api/cross-chain-flows/import` | message_hash | all fields |
| Local Flows | `POST /api/local-flows/import` | extrinsic_id | all fields |

## File Structure

```
src/api/src/routes/
├── categories.ts      # POST /import - INSERT OR IGNORE
├── referenda.ts       # POST /import - UPDATE with validation
├── bounties.ts        # POST /import - UPDATE with validation
├── child-bounties.ts  # POST /import - UPDATE with validation
├── treasury-netflows.ts
├── cross-chain-flows.ts
├── local-flows.ts
└── sync.ts            # GET /defaults/* - serve CSV files

src/api/src/db/queries.ts
├── bulkUpdateReferenda()
├── bulkUpdateBounties()
└── bulkUpdateChildBounties()

src/frontend/src/lib/csv-parser.ts
├── parseReferendaCSV()
├── parseChildBountiesCSV()
├── parseBountiesCSV()
├── parseTreasuryNetflowsCSV()
├── parseCategoriesCSV()
├── parseCrossChainFlowsCSV()
└── parseLocalFlowsCSV()
```

## Related Docs

- [Importing Data](../../howtos/importing-data.md) - Usage guide
- [Data Models](../../02_specification/data-models.md) - Table schemas
