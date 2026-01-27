# Codebase Refactoring Plan

**Started**: 2026-01-27
**Goal**: Improve code quality, maintainability, and observability

---

## Phase 1: Quick Wins ✅ COMPLETE

**Commit**: `8c9d199`

### 1.1 Create Shared Types Package ✅
- Created `@opengov-monitor/shared` package
- Eliminated ~500 lines of duplicate types
- Both API and Frontend now depend on shared types

### 1.2 Add ESLint Rule for `any` Type ✅
- Added `@typescript-eslint/no-explicit-any` as warning
- Tracking 93 existing `any` usages
- New code cannot introduce `any` without explicit override

### 1.3 Fix Silent Catch Blocks ✅
- Fixed 5 files with silent catch blocks
- `sync-settings.tsx`, `auth-context.tsx`, `queries.ts`, `use-view-state.ts`

### 1.4 Add Logging to API Route Handlers ✅
- Added `console.error("[routeName] Error:", error)` to 68 catch blocks
- Covers all 18 route files

---

## Phase 2: Split Large Files ⏳ IN PROGRESS

### 2.1 Split `data-table.tsx` ✅ COMPLETE
**Result**: 1,103 lines → 502 lines (55% reduction)

Extracted components (`components/` subdirectory):
- `card-view.tsx` - Mobile card view rendering
- `footer-totals.tsx` - Page totals, grand totals, legacy footer cells
- `table-view.tsx` - Desktop table view with hierarchical and standard modes

Extracted hooks (`hooks/` subdirectory):
- `use-page-totals.ts` - Page-level totals calculation for currency columns
- `use-hierarchical-data.ts` - Hierarchical data processing with subtotals
- `use-data-table-query.ts` - Data fetching with debouncing, abort control, facets
- `use-grand-totals-query.ts` - Grand totals fetching via SUM aggregates

Tests added: `__tests__/hooks.test.ts`
Docs updated: `docs/03_design/frontend/table-systems.md`

### 2.2 Split `query.ts` ✅ COMPLETE
**Result**: 974 lines → 226 lines in `index.ts` (77% reduction)

Extracted to `src/routes/query/` directory:
- `authorization.ts` (38 lines) - Table/view allowlists
- `security.ts` (155 lines) - SQL injection prevention, expression validation
- `column-cache.ts` (107 lines) - Column metadata caching
- `filter-builder.ts` (229 lines) - Filter → WHERE clause conversion
- `sql-builder.ts` (344 lines) - SELECT/JOIN/ORDER BY clause generation
- `index.ts` (226 lines) - Route handlers only

Docs updated: `src/api/CLAUDE.md`

### 2.3 Split `subsquare.py` ✅ COMPLETE
**Result**: 1,661 lines → 9 modules in `data_providers/subsquare/`

| Module | Lines | Purpose |
|--------|-------|---------|
| `__init__.py` | 232 | Main SubsquareProvider class |
| `api_client.py` | 74 | HTTP fetch utilities |
| `call_indices.py` | 180 | Runtime constants |
| `validation.py` | 200 | Data validation |
| `xcm_parsing.py` | 311 | XCM v3/v4/v5 parsing |
| `proposal_parser.py` | 260 | Proposal value extraction |
| `referenda.py` | 272 | Referenda fetch/transform |
| `treasury.py` | 320 | Treasury + child bounties |
| `fellowship.py` | 606 | Fellowship data |

API preserved via pass-through methods. All 149 tests pass.

---

## Phase 3: Add Tests for Complex Files ⏳ PENDING

### 3.1 Add unit tests for split modules
### 3.2 Add integration tests for critical paths
### 3.3 Increase test coverage to >80%

---

## Phase 4: Observability & CI/CD ⏳ PENDING

### 4.1 Add structured logging
### 4.2 Add performance monitoring
### 4.3 Add CI/CD quality gates

---

**Last Updated**: 2026-01-27 (Phase 2.3 complete)
