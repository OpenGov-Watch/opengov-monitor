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

**General:**
- [gotchas.md](reference/gotchas.md) - Project-specific quirks and workarounds

**Backend:**
- [backend/migration-system-design.md](reference/backend/migration-system-design.md) - Migration architecture and design decisions
- [migrations/patterns.md](reference/migrations/patterns.md) - Common migration patterns
- [migrations/troubleshooting.md](reference/migrations/troubleshooting.md) - Migration issues and fixes
- [migrations/testing-strategies.md](reference/migrations/testing-strategies.md) - How to test migrations
- [migrations/advanced-examples.md](reference/migrations/advanced-examples.md) - Complex migration scenarios

**Frontend:**
- [frontend/table-systems.md](reference/frontend/table-systems.md) - DataTable architecture reference
- [frontend/column-formatting.md](reference/frontend/column-formatting.md) - Column formatting and configuration

**Deployment:**
- [deployment/pre-deployment-checklist.md](reference/deployment/pre-deployment-checklist.md) - Detailed pre-deployment steps
- [deployment/post-deployment-verification.md](reference/deployment/post-deployment-verification.md) - Verification after deploy
- [deployment/debugging.md](reference/deployment/debugging.md) - Debugging deployments
- [deployment/common-issues.md](reference/deployment/common-issues.md) - Common deployment issues
- [deployment/local-docker-development.md](reference/deployment/local-docker-development.md) - Local Docker workflow