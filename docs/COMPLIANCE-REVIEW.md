# Documentation Compliance Review

Review date: 2026-01-16
Guidelines: `docs/CLAUDE.md`

## Overall Compliance: 40% - NEEDS SIGNIFICANT IMPROVEMENT

### Summary Statistics

- **Fully Compliant Files**: 12
- **Boundary Cases (100-150 lines)**: 5
- **Non-Compliant Files**: 7
- **Broken Links**: 1

## Critical Issues

### 1. Broken Link (PRIORITY 1)

**File**: `docs/README.md:13`
- **Current**: `[business-rules.md](spec/business-rules.md)`
- **Actual location**: `src/backend/docs/spec/business-rules.md`
- **Fix**: Change to `[business-rules.md](../src/backend/docs/spec/business-rules.md)`

### 2. Severe Length Violations (PRIORITY 1)

Files exceeding 400 lines (4x the guideline):

**src/deploy/README.md - 431 lines**
- Issue: Too long with extensive debugging, common issues, examples
- Fix: Move "Common Issues" → `docs/reference/deployment-troubleshooting.md`
- Fix: Move detailed debugging → reference doc
- Target: ~200-250 lines

**src/backend/migrations/README.md - 424 lines**
- Issue: Workflow, examples, patterns, troubleshooting all in one file
- Fix: Move "Common Patterns" → `docs/reference/migration-patterns.md`
- Fix: Move "Advanced Examples" → reference doc
- Target: ~200 lines

**docs/howtos/data-table.md - 591 lines**
- Issue: 7 sections with complete code examples, patterns, troubleshooting
- Fix: Split into:
  - `docs/howtos/data-table-basics.md` (sections 1-3)
  - `docs/howtos/data-table-advanced.md` (sections 5-7)
  - Keep current file as index linking to both

**docs/howtos/query-builder.md - 439 lines**
- Issue: Complete guide with examples, tips, advanced patterns
- Fix: Split into:
  - `docs/howtos/query-builder-basics.md` (sections 1-3)
  - `docs/howtos/query-builder-advanced.md` (section 6)

**docs/howtos/dashboard.md - 378 lines**
- Issue: Seven sections covering full workflow
- Fix: Split into:
  - `docs/howtos/dashboard-basics.md` (sections 1-3)
  - `docs/howtos/dashboard-advanced-layouts.md` (section 6)

**docs/howtos/filters.md - 300+ lines**
- Issue: Three filter types with extensive examples, operator lists
- Fix: Focus on usage patterns, move operator details to reference
- Target: ~150 lines

## Important Issues

### 3. Reference Documentation Violations (PRIORITY 2)

**docs/reference/frontend/table-systems.md - 277 lines**
- Issue: Shows code instead of linking
- Lines 45-81: "Data Integration" section with full code examples
- Fix: Replace code examples with links to how-to guides
- Fix: Replace detailed filtering section with summary + link
- Target: ~150 lines

### 4. Specification Files Mixing Implementation (PRIORITY 2)

**docs/spec/data-models.md - 191 lines**
- Issue: Contains implementation details mixed with requirements
- Lines 48-49: Category inheritance (implementation concern)
- Lines 187-190: Business logic for `hide_in_spends`
- Fix: Move implementation details to `docs/reference/`
- Keep: Pure specifications only (what/why, not how)

**docs/spec/backend/migrations.md - 205 lines**
- Issue: Contains architecture and design decisions
- "Key Design Decisions" section explains why, not just what
- Fix: More concise on requirements, less rationale
- Move: Design decisions to reference docs

**docs/spec/frontend/dashboard.md - 151 lines**
- Issue: Detailed grid system specs and breakpoint definitions
- Fix: Core requirements only, detailed API in reference docs

**docs/spec/frontend/query-builder.md - 158 lines**
- Issue: Extensive workflow, JOIN requirements, operators documentation
- Fix: Core requirements, defer detailed workflow to how-to guide

### 5. Content Duplication (PRIORITY 3)

**Moderate duplication found:**
- `docs/howtos/data-table.md` duplicates content from `docs/spec/frontend/data-table.md`
  - Example: "Column Auto-Formatting" section largely mirrors spec
- Multiple how-to guides repeat filter patterns that could be consolidated
- `docs/reference/frontend/table-systems.md` repeats dashboard integration from `docs/howtos/dashboard.md`

## File Inventory

### CLAUDE.md Files (All ✓ COMPLIANT)

| File | Lines | Status |
|------|-------|--------|
| Root CLAUDE.md | 49 | ✓ OK |
| src/backend/CLAUDE.md | 64 | ✓ OK |
| src/api/CLAUDE.md | 72 | ✓ OK |
| src/frontend/CLAUDE.md | 77 | ✓ OK |
| src/backend/migrations/CLAUDE.md | 3 | ✓ OK |
| src/deploy/CLAUDE.md | 62 | ✓ OK |
| docs/CLAUDE.md | 23 | ✓ OK |

### README.md Files

| File | Lines | Status | Action |
|------|-------|--------|--------|
| Root README.md | 177 | ✓ OK | None |
| src/frontend/README.md | 190 | ✓ OK | None |
| src/deploy/README.md | 431 | ✗ TOO LONG | Split content |
| src/backend/migrations/README.md | 424 | ✗ TOO LONG | Split content |
| docs/README.md | 39 | ✓ OK | Fix broken link |

### Specification Files (docs/spec/)

| File | Lines | Status | Action |
|------|-------|--------|--------|
| data-models.md | 191 | ⚠ BOUNDARY | Remove implementation details |
| backend/migrations.md | 205 | ⚠ OVER | Remove design rationale |
| frontend/data-table.md | 132 | ⚠ BOUNDARY | Acceptable |
| frontend/dashboard.md | 151 | ⚠ OVER | Remove detailed specs |
| frontend/query-builder.md | 158 | ⚠ OVER | Remove detailed workflow |
| frontend/filters.md | 90+ | ✓ OK | None |

### How-To Guides (docs/howtos/)

| File | Lines | Status | Action |
|------|-------|--------|--------|
| data-table.md | 591 | ✗ TOO LONG | Split into 3 files |
| query-builder.md | 439 | ✗ TOO LONG | Split into 2 files |
| dashboard.md | 378 | ✗ TOO LONG | Split into 2-3 files |
| filters.md | 300+ | ✗ TOO LONG | Consolidate |
| sanity-checks.md | 100+ | ✓ OK | None |

### Reference Files (docs/reference/)

| File | Lines | Status | Action |
|------|-------|--------|--------|
| gotchas.md | 114 | ⚠ BOUNDARY | Acceptable |
| frontend/table-systems.md | 277 | ✗ TOO LONG | Remove code, add links |
| frontend/README.md | 22 | ✓ OK | None |
| database-backups.md | 33 | ✓ OK | None |

### Other Documentation

| File | Lines | Status |
|------|-------|--------|
| docs/architecture.md | 50 | ✓ OK |

## Role Compliance Summary

| Category | Status | Key Issues |
|----------|--------|-----------|
| **CLAUDE.md files** | ✓ COMPLIANT | All brief, navigation-focused, <100 lines |
| **README.md files** | ⚠ PARTIAL | 2 files exceed 400 lines |
| **docs/spec/** | ⚠ PARTIAL | 4 files too long or contain implementation |
| **docs/reference/** | ⚠ PARTIAL | 1 file shows code instead of linking |
| **docs/howtos/** | ✗ NON-COMPLIANT | All 4 major guides far exceed limit |
| **docs/architecture.md** | ✓ COMPLIANT | Appropriate length and abstraction |
| **docs/CLAUDE.md** | ✓ COMPLIANT | Clear, concise guidelines |

## Recommendations

### Immediate Actions (PRIORITY 1)

1. **Fix broken link** in `docs/README.md:13`
2. **Split docs/howtos/data-table.md** (591 lines → 3 files)
3. **Split docs/howtos/query-builder.md** (439 lines → 2 files)
4. **Split docs/howtos/dashboard.md** (378 lines → 2-3 files)
5. **Trim src/deploy/README.md** (431 lines → ~250 lines)
6. **Trim src/backend/migrations/README.md** (424 lines → ~200 lines)

### Important Actions (PRIORITY 2)

7. **Reduce docs/reference/frontend/table-systems.md** (277 → ~150 lines)
8. **Remove implementation from docs/spec/data-models.md**
9. **Remove design rationale from docs/spec/backend/migrations.md**
10. **Consolidate filter documentation** to reduce duplication

### Polish Actions (PRIORITY 3)

11. **Reduce docs/spec/frontend/dashboard.md** (151 → ~120 lines)
12. **Reduce docs/spec/frontend/query-builder.md** (158 → ~120 lines)
13. **Consolidate repeated patterns** across how-to guides

## Estimated Effort

- **Total time**: 4-6 hours of documentation refactoring
- **Breaking down**:
  - Split how-to guides: 2-3 hours
  - Trim README files: 1 hour
  - Clean spec files: 1 hour
  - Fix duplication: 1 hour
  - Fix broken link: 5 minutes

## Guidelines Violations Not Found

✓ **No "recent changes" language** in documentation
✓ **No basic concept explanations** (docs assume expert audience)
✓ **All links verified** (except 1 broken link noted above)
