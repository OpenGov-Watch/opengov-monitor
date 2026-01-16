# Frontend Table Systems

**⚠️ This document has been split into separate, focused documents for better organization.**

## New Documentation Structure

This single file previously covered both the DataTable and Dashboard systems in 635 lines. It has been reorganized into:

### Specifications (Technical Details)

1. **[DataTable System](./data-table.md)** - Main TanStack Table system
   - Architecture and component hierarchy
   - Column configuration and auto-formatting
   - Filtering, sorting, and pagination
   - View state management
   - Authentication and editing
   - API integration

2. **[Dashboard System](./dashboard.md)** - Grid-based dashboard system
   - Dashboard architecture
   - Component types (tables, charts, text)
   - Grid layout and scrolling
   - QueryBuilder integration
   - Comparison with DataTable

3. **[QueryBuilder](./query-builder.md)** - Visual SQL query builder
   - Query configuration
   - JOIN system and auto-detection
   - Column selection and expressions
   - Aggregate functions
   - Limitations

4. **[Filtering Systems](./filters.md)** - Comprehensive filtering guide
   - FacetedFilter component
   - FilterGroupBuilder component
   - Global search
   - Comparison and best practices

### How-To Guides (Practical Examples)

1. **[DataTable How-To](../../howtos/data-table.md)** (formerly `howtos/tables.md`)
   - Step-by-step table creation
   - JOINs, editable columns, faceted filters
   - Custom rendering and default views
   - Complete examples

2. **[Dashboard How-To](../../howtos/dashboard.md)** - NEW
   - Creating dashboards
   - Adding tables and charts
   - Building queries with JOINs
   - Layout and positioning

3. **[QueryBuilder How-To](../../howtos/query-builder.md)** - NEW
   - Basic queries
   - JOIN patterns
   - Expressions and aggregates
   - Filter patterns

4. **[Filtering How-To](../../howtos/filters.md)** - NEW
   - Using faceted filters
   - Global search strategies
   - Advanced filter building
   - Combining filters

### Reference Documentation (API Details)

See the [reference/frontend/](../../reference/frontend/) directory for component API references.

## Migration Guide

If you were linking to specific sections in this file:

- **DataTable architecture** → [data-table.md](./data-table.md)
- **Dashboard architecture** → [dashboard.md](./dashboard.md)
- **Query building** → [query-builder.md](./query-builder.md)
- **Filtering** → [filters.md](./filters.md)
- **How-to examples** → [howtos/data-table.md](../../howtos/data-table.md)
- **Dashboard examples** → [howtos/dashboard.md](../../howtos/dashboard.md)

## Why This Change?

The original tables.md file:
- Mixed two distinct systems (DataTable and Dashboard)
- Was difficult to navigate at 635 lines
- Lacked dedicated how-to guides for Dashboard and QueryBuilder
- Had reference documentation mixed with specifications

The new structure:
- Separates concerns (DataTable vs Dashboard vs QueryBuilder vs Filters)
- Provides both specifications and practical guides
- Easier to find specific information
- Better organized for maintenance
