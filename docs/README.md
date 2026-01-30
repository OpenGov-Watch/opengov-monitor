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

**Features:**
- [features/data-views.md](01_requirements/features/data-views.md) - Public data exploration pages
- [features/manage-section.md](01_requirements/features/manage-section.md) - Authenticated admin pages
- [features/authentication.md](01_requirements/features/authentication.md) - Login, session, auth state
- [features/navigation.md](01_requirements/features/navigation.md) - Sidebar, layout, responsive navigation

### `02_specification/` - Technical Specifications

**Data:**
- [data-models.md](02_specification/data-models.md) - Database tables, views, fields

**Backend:**
- [backend/migrations.md](02_specification/backend/migrations.md) - Database migration requirements

**Security:**
- [security/](02_specification/security/README.md) - Security specification (authentication, API, transport, container)

**Frontend:**
- [frontend/page-specifications.md](02_specification/frontend/page-specifications.md) - Columns, filters, sorts per page
- [frontend/form-specifications.md](02_specification/frontend/form-specifications.md) - Form fields, validation rules
- [frontend/filter-types.md](02_specification/frontend/filter-types.md) - Column types, operators
- [frontend/ui-constants.md](02_specification/frontend/ui-constants.md) - Breakpoints, limits, dimensions

**API:**
- [api/endpoints.md](02_specification/api/endpoints.md) - REST API endpoints

### `03_design/` - Implementation Details

Quick overview of key implementation patterns. Links to code, doesn't show code.

**General:**
- [architecture.md](03_design/architecture.md) - System architecture overview
- [gotchas.md](03_design/gotchas.md) - Project-specific quirks and workarounds
- [error-logging.md](03_design/error-logging.md) - Error logging system
- [database-backups.md](03_design/database-backups.md) - Backup procedures
- [testing.md](03_design/testing.md) - Testing patterns and CI integration

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
- [frontend/](03_design/frontend/README.md) - Frontend component API reference
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

**Categories & Data:**
- [categories.md](howtos/categories.md) - Managing spending categories
- [category-inheritance.md](howtos/category-inheritance.md) - Category inheritance patterns
- [importing-data.md](howtos/importing-data.md) - Bulk importing data via CSV
- [custom-tables.md](howtos/custom-tables.md) - Creating custom tables
- [adding-scraped-tables.md](howtos/adding-scraped-tables.md) - Adding scraped data tables
- [adding-sync-tables.md](howtos/adding-sync-tables.md) - Adding synchronized tables
- [renaming-columns-tables.md](howtos/renaming-columns-tables.md) - Renaming columns and tables

**Dashboard:**
- [dashboard.md](howtos/dashboard.md) - Dashboard overview
  - [dashboard-basics.md](howtos/dashboard-basics.md) - Getting started
  - [dashboard-advanced.md](howtos/dashboard-advanced.md) - Advanced features

**DataTable:**
- [data-table.md](howtos/data-table.md) - DataTable overview
  - [data-table-basics.md](howtos/data-table-basics.md) - Getting started
  - [data-table-advanced.md](howtos/data-table-advanced.md) - Advanced features
- [table-views.md](howtos/table-views.md) - Table view management

**Filters:**
- [filters.md](howtos/filters.md) - Filtering overview
  - [filters-basics.md](howtos/filters-basics.md) - Getting started
  - [filters-advanced.md](howtos/filters-advanced.md) - Advanced filtering

**Query Builder:**
- [query-builder.md](howtos/query-builder.md) - Query builder overview
  - [query-builder-basics.md](howtos/query-builder-basics.md) - Getting started
  - [query-builder-advanced.md](howtos/query-builder-advanced.md) - Advanced queries

**Data Quality:**
- [sanity-checks.md](howtos/sanity-checks.md) - Writing data validation sanity checks
- [investigate-data-errors.md](howtos/investigate-data-errors.md) - Investigating data errors
- [regression-testing-xcm-parsing.md](howtos/regression-testing-xcm-parsing.md) - XCM parsing regression tests
