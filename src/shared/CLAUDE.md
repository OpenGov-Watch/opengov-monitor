# Shared Package

TypeScript types shared between API and Frontend packages.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core entity types, QueryConfig, dashboard types, constants |

## Usage

Both packages re-export from here:
- API: `src/api/src/db/types.ts` adds import types
- Frontend: `src/frontend/src/lib/db/types.ts` adds edit config types

## Types Included

- Entity types: `Referendum`, `TreasurySpend`, `ChildBounty`, `Fellowship`, etc.
- Query types: `QueryConfig`, `FilterCondition`, `FilterGroup`, `JoinConfig`
- Dashboard types: `Dashboard`, `DashboardComponent`, `GridConfig`, `ChartConfig`
- Constants: `TABLE_NAMES`, `VIEW_NAMES`, `QUERYABLE_TABLE_NAMES`
