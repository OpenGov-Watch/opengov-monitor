# Documentation

Documentation for the OpenGov Monitor project.

## Structure

### `01_requirements/` - Requirements

Defines **what** the system must do, not **how** it's implemented.

**Data & Business Logic:**
- [user-stories.md](01_requirements/user-stories.md) - User stories and goals
- [business-rules.md](01_requirements/business-rules.md) - Spending categorization, calculations

**Frontend:**
- [frontend/data-table.md](01_requirements/frontend/data-table.md) - DataTable requirements
- [frontend/dashboard.md](01_requirements/frontend/dashboard.md) - Dashboard system requirements
- [frontend/query-builder.md](01_requirements/frontend/query-builder.md) - Query builder requirements
- [frontend/filters.md](01_requirements/frontend/filters.md) - Filtering system requirements

### `02_specification/` - Technical Specifications

**Data:**
- [data-models.md](02_specification/data-models.md) - Database tables, views, fields

**Backend:**
- [backend/migrations.md](02_specification/backend/migrations.md) - Database migration requirements

### `03_design/` - Implementation Details

Quick overview of key implementation patterns. Links to code, doesn't show code.

**General:**
- [architecture.md](03_design/architecture.md) - System architecture overview
- [gotchas.md](03_design/gotchas.md) - Project-specific quirks and workarounds
- [error-logging.md](03_design/error-logging.md) - Error logging system
- [database-backups.md](03_design/database-backups.md) - Backup procedures

**Backend:**
- [backend/architecture.md](03_design/backend/architecture.md) - Backend data pipeline architecture
- [backend/migration-system-design.md](03_design/backend/migration-system-design.md) - Migration architecture and design decisions
- [migrations/patterns.md](03_design/migrations/patterns.md) - Common migration patterns
- [migrations/troubleshooting.md](03_design/migrations/troubleshooting.md) - Migration issues and fixes
- [migrations/testing-strategies.md](03_design/migrations/testing-strategies.md) - How to test migrations
- [migrations/advanced-examples.md](03_design/migrations/advanced-examples.md) - Complex migration scenarios

**API:**
- [api/architecture.md](03_design/api/architecture.md) - Express API architecture
- [api/import-system.md](03_design/api/import-system.md) - Import validation architecture

**Frontend:**
- [frontend/architecture.md](03_design/frontend/architecture.md) - Frontend React architecture
- [frontend/table-systems.md](03_design/frontend/table-systems.md) - DataTable architecture reference
- [frontend/column-formatting.md](03_design/frontend/column-formatting.md) - Column formatting and configuration

**Deployment:**
- [deployment/pre-deployment-checklist.md](03_design/deployment/pre-deployment-checklist.md) - Detailed pre-deployment steps
- [deployment/post-deployment-verification.md](03_design/deployment/post-deployment-verification.md) - Verification after deploy
- [deployment/debugging.md](03_design/deployment/debugging.md) - Debugging deployments
- [deployment/common-issues.md](03_design/deployment/common-issues.md) - Common deployment issues
- [deployment/local-docker-development.md](03_design/deployment/local-docker-development.md) - Local Docker workflow

### `howtos/` - Usage Guides

Step-by-step guides for using features. Code examples included.

- [categories.md](howtos/categories.md) - Managing spending categories
- [importing-data.md](howtos/importing-data.md) - Bulk importing data via CSV
- [dashboard.md](howtos/dashboard.md) - Creating custom dashboards
- [data-table.md](howtos/data-table.md) - Creating table pages with DataTable
- [filters.md](howtos/filters.md) - Using faceted filters, global search, advanced filters
- [query-builder.md](howtos/query-builder.md) - Building queries visually
- [sanity-checks.md](howtos/sanity-checks.md) - Writing data validation sanity checks
