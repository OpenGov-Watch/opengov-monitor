# Documentation

Documentation for the OpenGov Monitor project.

## Structure

### `spec/` - Requirements & Specifications

Defines **what** the system must do, not **how** it's implemented.

**Data & Business Logic:**
- [data-models.md](spec/data-models.md) - Database tables, views, fields
- [business-rules.md](../src/backend/docs/spec/business-rules.md) - Spending categorization, calculations

**Backend:**
- [backend/migrations.md](spec/backend/migrations.md) - Database migration requirements

**Frontend:**
- [frontend/data-table.md](spec/frontend/data-table.md) - DataTable requirements
- [frontend/dashboard.md](spec/frontend/dashboard.md) - Dashboard system requirements
- [frontend/query-builder.md](spec/frontend/query-builder.md) - Query builder requirements
- [frontend/filters.md](spec/frontend/filters.md) - Filtering system requirements

### `howtos/` - Usage Guides

Step-by-step guides for using features. Code examples included.

- [categories.md](howtos/categories.md) - Managing spending categories, bulk imports, apply defaults
- [dashboard.md](howtos/dashboard.md) - Creating custom dashboards
- [data-table.md](howtos/data-table.md) - Creating table pages with DataTable
- [filters.md](howtos/filters.md) - Using faceted filters, global search, advanced filters
- [query-builder.md](howtos/query-builder.md) - Building queries visually
- [sanity-checks.md](howtos/sanity-checks.md) - Writing data validation sanity checks

### `reference/` - Implementation Details

Quick overview of key implementation patterns. Links to code, doesn't show code.

- [gotchas.md](reference/gotchas.md) - Project-specific quirks and workarounds
- [frontend/table-systems.md](reference/frontend/table-systems.md) - DataTable architecture reference