# Next Steps: Complete DataTable Migration

## Progress: 3/11 Pages Migrated (27%)

### ✅ Completed Pages
1. Fellowship (simple, no JOINs, no editing)
2. Referenda (complex: JOINs + full editing + faceted filters)
3. Treasury (medium: no JOINs, faceted filters, custom views)

### ⏳ Remaining Pages (Ordered by Complexity)

#### Batch 1: Simple Pages (No JOINs, No Editing)
**Estimated: 30-45 minutes total**

4. **Fellowship Salary Cycles** (`frontend/src/pages/fellowship-salary-cycles.tsx`)
   - Source: Fellowship Salary Cycles table
   - Columns: cycle, url, budget_dot, registeredCount, etc.
   - Features: Simple display, no auth-gating
   - Pattern: Copy Fellowship page, update column list

5. **Fellowship Salary Claimants** (`frontend/src/pages/fellowship-salary-claimants.tsx`)
   - Source: Fellowship Salary Claimants table
   - Columns: address, display_name, rank, registered_amount_dot, etc.
   - Features: Simple display, no auth-gating
   - Pattern: Copy Fellowship page, update column list

6. **Fellowship Subtreasury** (`frontend/src/pages/fellowship-subtreasury.tsx`)
   - Source: Fellowship Subtreasury table
   - Columns: id, url, title, status, DOT_*, USD_*, dates
   - Features: Simple display, status badge
   - Pattern: Copy Fellowship page, add status faceted filter

#### Batch 2: VIEW Pages (No Editing, Read-Only)
**Estimated: 30-45 minutes total**

7. **Outstanding Claims** (`frontend/src/pages/outstanding-claims.tsx`)
   - Source: outstanding_claims VIEW
   - Columns: id, url, status, description, DOT_*, USD_*, claim_type, days_until_expiry
   - Features: Status + claim_type faceted filters
   - Pattern: Copy Treasury page, update QueryConfig sourceTable to "outstanding_claims"

8. **Expired Claims** (`frontend/src/pages/expired-claims.tsx`)
   - Source: expired_claims VIEW
   - Columns: id, url, status, description, DOT_*, USD_*, days_since_expiry
   - Features: Status faceted filter
   - Pattern: Copy Treasury page, update QueryConfig sourceTable to "expired_claims"

#### Batch 3: JOIN Pages with Editing
**Estimated: 1-2 hours total**

9. **Child Bounties** (`frontend/src/pages/child-bounties.tsx`)
   - Source: Child Bounties table
   - JOINs: Categories (for category/subcategory), Bounties (for parentBountyName)
   - Editable: category_id, notes, hide_in_spends
   - Features: Full editing like Referenda
   - Pattern: Copy Referenda page, add second JOIN

10. **Bounties** (`frontend/src/pages/bounties.tsx`)
   - Source: bounties table
   - JOINs: Categories (for category/subcategory)
   - Editable: category_id (maybe name?)
   - Features: Category editing
   - Pattern: Copy Referenda page, simpler editConfig

11. **Subtreasury** (`frontend/src/pages/subtreasury.tsx`)
   - Source: subtreasury table
   - JOINs: Categories (for category/subcategory)
   - Editable: category_id
   - Features: Category editing
   - Pattern: Copy Referenda page, simpler editConfig

---

## Migration Checklist (Per Page)

Use this for each page migration:

### Before Migration
- [ ] Read current page file (`frontend/src/pages/*.tsx`)
- [ ] Read current column factory (`frontend/src/components/tables/*-columns.tsx`)
- [ ] Note: JOINs needed? Editable columns? Faceted filters? Custom overrides?

### During Migration
- [ ] Create QueryConfig with all columns
- [ ] Add JOINs if page uses category/subcategory or other denormalized fields
- [ ] Create editConfig if page has editable columns (auth-gated)
- [ ] Identify facetedFilters from old DataTableFacetedFilter usage
- [ ] Create columnOverrides for custom rendering (links, truncation, etc.)
- [ ] Keep defaultViews if any exist
- [ ] Set defaultSorting to match old page

### After Migration
- [ ] Run `pnpm build` - must succeed
- [ ] Test in browser:
  - [ ] Columns render correctly with proper formatting
  - [ ] Currency/number columns right-aligned
  - [ ] Dates formatted as "Jan 15, 2025"
  - [ ] Faceted filters show dropdown with multi-select
  - [ ] Sorting works (ASC/DESC/none cycle)
  - [ ] Global search filters across all columns
  - [ ] Column visibility toggle works
  - [ ] Editable columns work when authenticated (if applicable)
  - [ ] Read-only columns show when not authenticated (if applicable)
  - [ ] Views save/load/delete correctly
  - [ ] Export CSV/JSON works
  - [ ] Mobile card view works
- [ ] Note bundle size change (should decrease ~40-50%)

---

## Batch Execution Strategy

### Session 1: Simple Pages (4, 5, 6)
**Duration: ~1 hour**

1. Migrate Fellowship Salary Cycles
2. Migrate Fellowship Salary Claimants
3. Migrate Fellowship Subtreasury
4. Verify all 3 builds succeed
5. Quick browser test of each

### Session 2: VIEW Pages (7, 8)
**Duration: ~45 minutes**

1. Migrate Outstanding Claims
2. Migrate Expired Claims
3. Verify build succeeds
4. Quick browser test of each

### Session 3: Complex Pages (9, 10, 11)
**Duration: ~2 hours**

1. Migrate Child Bounties (2 JOINs + full editing)
2. Test thoroughly (most complex)
3. Migrate Bounties (1 JOIN + editing)
4. Migrate Subtreasury (1 JOIN + editing)
5. Verify all builds succeed
6. Thorough testing of editing features

### Session 4: Cleanup
**Duration: ~30 minutes**

1. Delete old column factory files (8 files)
2. Delete old query functions from `api/src/db/queries.ts` (8 functions)
3. Update imports if any other files reference deleted factories
4. Run `pnpm build` - verify no errors
5. Run `pnpm test:run` - verify all tests pass
6. Final verification: test 2-3 migrated pages end-to-end

---

## Quick Reference: Migration Templates

### Simple Page Template (No JOINs, No Editing)
```typescript
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { QueryConfig } from "@/lib/db/types";
import type { YourType } from "@/lib/db/types";

export default function YourPage() {
  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "YourTable",
    columns: [
      { column: "id" },
      { column: "column1" },
      // ... all columns
    ],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Page</h1>
        <p className="text-muted-foreground">Description</p>
      </div>
      <DataTable<YourType>
        mode="query"
        queryConfig={queryConfig}
        tableName="your_table"
        facetedFilters={["status"]}  // if applicable
        defaultSorting={[{ id: "id", desc: true }]}
      />
    </div>
  );
}
```

### Complex Page Template (JOINs + Editing)
```typescript
import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { DataTable } from "@/components/data-table/data-table";
import { useAuth } from "@/contexts/auth-context";
import { QueryConfig, DataTableEditConfig, Category } from "@/lib/db/types";
import type { YourType } from "@/lib/db/types";

export default function YourPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    api.categories.getAll().then((res) => setCategories(res as Category[]));
  }, []);

  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "YourTable",
    columns: [
      { column: "id" },
      { column: "category_id" },
      { column: "notes" },
      { column: "c.category", alias: "category" },
      { column: "c.subcategory", alias: "subcategory" },
    ],
    joins: [{
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: { left: "YourTable.category_id", right: "c.id" }
    }],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  const editConfig: DataTableEditConfig | undefined = useMemo(() => {
    if (!isAuthenticated) return undefined;
    return {
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories,
          onUpdate: async (id: number, value: number) => {
            await api.yourResource.update(id, { category_id: value });
          }
        },
        notes: {
          type: "text",
          onUpdate: async (id: number, value: string) => {
            await api.yourResource.update(id, { notes: value });
          },
          placeholder: "Add notes..."
        },
      }
    };
  }, [isAuthenticated, categories]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Your Page</h1>
        <p className="text-muted-foreground text-sm">Description</p>
      </div>
      <DataTable<YourType>
        mode="query"
        queryConfig={queryConfig}
        tableName="your_table"
        editConfig={editConfig}
        isAuthenticated={isAuthenticated}
        facetedFilters={["status"]}
        defaultSorting={[{ id: "id", desc: true }]}
      />
    </div>
  );
}
```

---

## Files to Delete in Cleanup Phase

### Column Factory Files (8 files)
```
frontend/src/components/tables/fellowship-columns.tsx
frontend/src/components/tables/referenda-columns.tsx
frontend/src/components/tables/treasury-columns.tsx
frontend/src/components/tables/child-bounties-columns.tsx
frontend/src/components/tables/bounties-columns.tsx
frontend/src/components/tables/subtreasury-columns.tsx
frontend/src/components/tables/outstanding-claims-columns.tsx
frontend/src/components/tables/expired-claims-columns.tsx
frontend/src/components/tables/fellowship-salary-cycles-columns.tsx
frontend/src/components/tables/fellowship-salary-claimants-columns.tsx
```

### Query Functions (from `api/src/db/queries.ts`)
```typescript
getReferenda()
getTreasury()
getChildBounties()
getFellowship()
getOutstandingClaims()
getExpiredClaims()
getFellowshipSalaryCycles()
getFellowshipSalaryClaimants()
```

### API Endpoints (partial deletion - keep PATCH handlers)
```
api/src/routes/referenda.ts - DELETE GET / handler only
api/src/routes/treasury.ts - DELETE GET / handler only
api/src/routes/child-bounties.ts - DELETE GET / handler only
api/src/routes/fellowship.ts - DELETE GET handlers only
api/src/routes/claims.ts - DELETE GET handlers only
api/src/routes/salary.ts - DELETE GET handlers only
```

**Keep all PATCH/POST/DELETE endpoints** - update logic still needed!

---

## Success Metrics

- All 11 pages migrated to query mode
- Bundle size reduced by ~40-50% per page
- Zero TypeScript errors
- All tests passing
- Build succeeds
- No performance regression
- Documentation complete and accurate
- Zero redundant code (old factories/endpoints removed)

---

## Ready to Execute?

Start with **Batch 1** (simple pages) to build momentum, then tackle more complex pages. Each batch should take 45min-2hrs depending on complexity.

Current files available for reference:
- ✅ `frontend/src/pages/fellowship.tsx` - Simple template
- ✅ `frontend/src/pages/referenda.tsx` - Complex template with JOINs + editing
- ✅ `frontend/src/pages/treasury.tsx` - Medium template with views
- ✅ `docs/howtos/tables.md` - Complete documentation
