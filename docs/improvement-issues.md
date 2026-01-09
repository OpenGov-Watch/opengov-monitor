# Improvement Issues

This document tracks potential improvements and technical debt identified during a comprehensive project review.

---

## High Priority

### 1. Fix `all_spending` View Schema
**Location**: `backend/data_sinks/sqlite/schema.py`, `api/src/db/queries.ts`

The database view has schema issues (references non-existent columns). Currently the API uses a custom SQL query as a workaround.

**Tasks**:
- [ ] Audit the view definition in schema.py
- [ ] Update column references to match actual table schemas
- [ ] Test view output matches API custom query
- [ ] Remove custom query workaround once view is fixed

---

### 2. Add API Rate Limiting for Subsquare Calls
**Location**: `backend/data_providers/subsquare.py`

No explicit rate limiting when calling Subsquare API. Risk of hitting rate limits or being blocked during large fetches.

**Tasks**:
- [ ] Add configurable delay between API calls
- [ ] Implement exponential backoff on 429 responses
- [ ] Add rate limit tracking/logging

---

### 3. Improve XCM Call Parsing
**Location**: `backend/data_providers/subsquare.py`

Cross-chain (XCM) call parsing is not fully implemented. Some proposals with XCM transfers may show incorrect values.

**Tasks**:
- [ ] Document XCM call index patterns
- [ ] Implement value extraction for common XCM patterns
- [ ] Add test cases for XCM proposals

---

## Medium Priority

### 4. Expand Test Coverage
**Locations**: All components

Current test coverage is limited:
- Backend: Basic pytest tests exist
- API: Route tests for CRUD operations
- Frontend: Minimal/no tests

**Tasks**:
- [ ] Add integration tests for backend data pipeline
- [ ] Add API tests for query builder edge cases
- [ ] Add React Testing Library tests for key components
- [ ] Set up CI coverage reporting

---

### 5. Improve Error Handling UX
**Location**: `frontend/src/pages/*.tsx`, `frontend/src/components/dashboard/`

Error messages are displayed but could be more user-friendly with actionable guidance.

**Tasks**:
- [ ] Create standardized error display component
- [ ] Add retry buttons for failed API calls
- [ ] Provide contextual help for common errors
- [ ] Add toast notifications for transient errors

---

### 6. Consolidate Hardcoded Call Indices
**Location**: `backend/data_providers/subsquare.py`

100+ call indices hardcoded for known zero-value proposal types. Maintenance burden and risk of missing new indices.

**Tasks**:
- [ ] Extract indices to configuration file
- [ ] Document what each index represents
- [ ] Consider fetching call metadata from chain
- [ ] Add logging when unknown indices encountered

---

### 7. Add Frontend Loading Skeletons
**Location**: `frontend/src/pages/*.tsx`

Most pages show simple "Loading..." text. Could improve perceived performance with skeleton screens.

**Tasks**:
- [ ] Create page-specific skeleton components
- [ ] Use shadcn Skeleton component consistently
- [ ] Match skeleton layout to actual content

---

## Low Priority

### 8. Implement Dark Mode
**Location**: `frontend/src/`

Tailwind CSS and shadcn/ui support dark mode. Currently only light theme implemented.

**Tasks**:
- [ ] Add theme toggle to sidebar/header
- [ ] Implement dark color scheme variables
- [ ] Test charts and tables in dark mode
- [ ] Persist theme preference in localStorage

---

### 9. Add Keyboard Shortcuts
**Location**: `frontend/src/`

No keyboard navigation shortcuts for power users.

**Tasks**:
- [ ] Add `?` for help/shortcuts overlay
- [ ] Add navigation shortcuts (g+r for referenda, etc.)
- [ ] Add table shortcuts (/, for search, j/k for rows)

---

### 10. Optimize Dashboard Query Execution
**Location**: `frontend/src/components/dashboard/dashboard-component.tsx`

Each dashboard component fetches data independently. Could batch requests for dashboards with multiple components.

**Tasks**:
- [ ] Consider batching queries on dashboard load
- [ ] Add query result caching (with TTL)
- [ ] Implement stale-while-revalidate pattern

---

### 11. Add Data Freshness Indicator
**Location**: `frontend/src/`, `api/src/`

Users can't easily see when data was last updated.

**Tasks**:
- [ ] Track last fetch timestamp in database
- [ ] Add "Last updated" indicator to pages
- [ ] Consider auto-refresh option for dashboards

---

### 12. Improve Column Configuration System
**Location**: `frontend/src/lib/column-renderer.ts`

Column display names and formatting are partially hardcoded across multiple files.

**Tasks**:
- [ ] Centralize all column metadata in config file
- [ ] Support user-customizable column names
- [ ] Add column format presets (currency, date, percentage)

---

## Documentation Gaps

### 13. Add OpenAPI Specification
**Location**: `docs/`, `api/`

Prose API documentation exists in `docs/spec/api-reference.md`, but no machine-readable OpenAPI/Swagger spec for tooling integration.

**Tasks**:
- [ ] Generate OpenAPI spec from routes (or write manually)
- [ ] Add Swagger UI for interactive exploration
- [ ] Keep spec in sync with api-reference.md

---

### 14. Add User Guide
**Location**: `docs/`

No end-user documentation for dashboard features.

**Tasks**:
- [ ] Document dashboard builder workflow
- [ ] Add query builder tutorial
- [ ] Document export functionality

---

## Refactoring Opportunities

### 15. Extract Common Table Column Patterns
**Location**: `frontend/src/components/tables/*.tsx`

Many column definitions share similar patterns (USD formatting, date formatting, status badges).

**Tasks**:
- [ ] Create column definition factories
- [ ] Reduce duplication across column files

---

### 16. Unify Date Handling
**Location**: All components

Date handling varies between components (UTC vs local, different formats).

**Tasks**:
- [ ] Standardize on UTC storage, local display
- [ ] Create shared date formatting utilities
- [ ] Ensure consistent timezone handling

---

## Performance

### 17. Add Database Indexes
**Location**: `backend/data_sinks/sqlite/schema.py`

Some common query patterns may benefit from additional indexes.

**Tasks**:
- [ ] Profile slow queries
- [ ] Add indexes for dashboard query patterns
- [ ] Consider covering indexes for common filters

---

### 18. Implement Virtual Scrolling
**Location**: `frontend/src/components/data-table/`

Large datasets could benefit from virtual scrolling instead of pagination.

**Tasks**:
- [ ] Evaluate TanStack Virtual integration
- [ ] Add as alternative to pagination for large tables

---

## Notes

- Issues are roughly ordered by impact and effort within each priority level
- Some issues may become obsolete as the project evolves
- Check for duplicates in existing issue tracker before implementing
