# Chapter 4: Data Table Performance

**Status**: ⏳ Pending
**Priority**: HIGH
**Estimated Time**: 2-3 hours

---

## Objective

Optimize TanStack Table implementation, column rendering, and explore virtualization opportunities for large datasets.

---

## Files to Review

### Core DataTable (6 files)
- `src/frontend/src/components/data-table/data-table.tsx` - Main table component
- `src/frontend/src/components/data-table/data-table-card.tsx` - Card wrapper
- `src/frontend/src/components/data-table/toolbar.tsx` - Filter/sort toolbar
- `src/frontend/src/components/data-table/pagination.tsx` - Pagination
- `src/frontend/src/components/data-table/view-selector.tsx` - View management

### Column Definitions (12 files)
- `src/frontend/src/components/tables/referenda-columns.tsx`
- `src/frontend/src/components/tables/treasury-columns.tsx`
- `src/frontend/src/components/tables/child-bounties-columns.tsx`
- `src/frontend/src/components/tables/fellowship-columns.tsx`
- `src/frontend/src/components/tables/fellowship-salary-cycles-columns.tsx`
- `src/frontend/src/components/tables/fellowship-salary-claimants-columns.tsx`
- `src/frontend/src/components/tables/spending-columns.tsx`
- `src/frontend/src/components/tables/claims-columns.tsx`
- And others...

### Column System (3 files)
- `src/frontend/src/lib/auto-columns.tsx` - Auto-column generation
- `src/frontend/src/lib/column-renderer.ts` - Rendering logic
- `src/frontend/src/lib/column-metadata.ts` - Metadata utilities

### Renderers
- `src/frontend/src/components/renderers/*.tsx` - Value renderers

---

## Applicable React Best Practices

### HIGH Priority

#### 5.2 Extract to Memoized Components
**What to check**: Are cell renderers properly memoized?

**Pattern to look for in column definitions**:
```tsx
// ❌ Inline cell renderer - recreated on every render
{
  id: 'title',
  cell: ({ row }) => (
    <div className="max-w-[400px] truncate">
      {row.original.title}
    </div>
  )
}

// ✅ Memoized cell renderer
const TitleCell = memo(function TitleCell({ value }: { value: string }) {
  return <div className="max-w-[400px] truncate">{value}</div>;
});

{
  id: 'title',
  cell: ({ row }) => <TitleCell value={row.original.title} />
}
```

**Action**: Review all column definitions for inline renderers

---

#### 6.2 CSS content-visibility for Long Lists
**What to check**: Should tables use `content-visibility: auto`?

**Current approach**: Pagination (100 rows per page)
- Good for now, but if we increase page size...

**Pattern to implement**:
```css
.data-table-row {
  content-visibility: auto;
  contain-intrinsic-size: 0 48px; /* estimated row height */
}
```

**Questions**:
1. What's the typical row count per page?
2. Do any pages load 500+ rows?
3. Would virtual scrolling be better than pagination?

---

#### 7.2 Build Index Maps for Repeated Lookups
**What to check**: Category/lookup operations in column renderers

**Observed pattern** (from earlier):
```tsx
// referenda.tsx - Line 58-83
editConfig: {
  editableColumns: {
    category_id: {
      type: "category-selector",
      categories, // ❌ Array - lookups are O(n)
      onUpdate: async (id: number, value: number) => {
        await api.referenda.update(id, { category_id: value });
      }
    }
  }
}
```

**Issue**: If category selector does `categories.find(c => c.id === value)`, it's O(n)

**Recommended Fix**:
```tsx
// Build Map once
const categoryById = useMemo(
  () => new Map(categories.map(c => [c.id, c])),
  [categories]
);

editConfig: {
  editableColumns: {
    category_id: {
      type: "category-selector",
      categoryMap: categoryById, // ✅ O(1) lookups
      ...
    }
  }
}
```

---

### MEDIUM Priority

#### 6.3 Hoist Static JSX Elements
**What to check**: Are column headers/footers recreated every render?

**Pattern to look for**:
```tsx
// ❌ Recreated on every render
const columns = useMemo(() => [
  {
    header: () => <div className="font-bold">Title</div>
  }
], []);

// ✅ Hoisted
const titleHeader = <div className="font-bold">Title</div>;
const columns = useMemo(() => [
  { header: () => titleHeader }
], []);
```

---

#### 7.6 Combine Multiple Array Iterations
**What to check**: Column filtering/sorting logic

**Pattern to look for**:
```tsx
// ❌ Multiple iterations
const filtered = data.filter(row => row.status === 'active');
const sorted = filtered.sort((a, b) => a.id - b.id);
const mapped = sorted.map(row => ({ ...row, formatted: format(row) }));

// ✅ Single iteration (if possible)
const processed = data.reduce((acc, row) => {
  if (row.status === 'active') {
    acc.push({ ...row, formatted: format(row) });
  }
  return acc;
}, []).sort((a, b) => a.id - b.id);
```

**Note**: TanStack Table handles most of this internally, but check custom processing

---

#### 7.11 Use Set/Map for O(1) Lookups
**What to check**: Filter operations

**Pattern to look for**:
```tsx
// ❌ O(n) lookup in filter
const allowedIds = [1, 2, 3, 4, 5];
const filtered = data.filter(row => allowedIds.includes(row.id));

// ✅ O(1) lookup with Set
const allowedIds = new Set([1, 2, 3, 4, 5]);
const filtered = data.filter(row => allowedIds.has(row.id));
```

---

#### 7.12 Use toSorted() Instead of sort()
**What to check**: Are we mutating arrays with .sort()?

**Pattern to look for**:
```tsx
// ❌ Mutates original array
const sortedData = data.sort((a, b) => a.id - b.id);

// ✅ Creates new sorted array
const sortedData = data.toSorted((a, b) => a.id - b.id);
// OR
const sortedData = [...data].sort((a, b) => a.id - b.id);
```

**Action**: Search for `.sort(` in data table files

---

## Virtualization Analysis

### Should We Implement Virtual Scrolling?

**Current**: Pagination (100 rows/page)
**Alternative**: Virtual scrolling (TanStack Virtual)

**Questions to answer**:
1. What's the largest dataset users view?
2. Is pagination sufficient or limiting?
3. Would infinite scroll improve UX?
4. Performance cost of rendering 100 rows?

**If implementing virtualization**:
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// Add to DataTable
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 48, // row height
  overscan: 5
});

// Render only visible rows
{rowVirtualizer.getVirtualItems().map(virtualRow => {
  const row = rows[virtualRow.index];
  return <TableRow key={row.id} row={row} />;
})}
```

---

## TanStack Table Configuration Audit

### Check Current Settings

Review DataTable implementation:
```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFacetedRowModel: getFacetedRowModel(), // ✅ Good for filters
  getFacetedUniqueValues: getFacetedUniqueValues(), // ✅ Good for filters
  getGroupedRowModel: getGroupedRowModel(), // Is this needed?
  getExpandedRowModel: getExpandedRowModel(), // Is this used?
  // ... other config
});
```

**Questions**:
1. Are all row models necessary?
2. Is faceting causing performance issues?
3. Should we enable column sizing?
4. Is pagination server-side or client-side?

---

## Column Renderer Performance

### Audit Pattern

For each column definition file:

1. **Count inline renderers**: How many `cell: ({ row }) => <div>` patterns?
2. **Check memoization**: Are complex renderers memoized?
3. **Identify expensive operations**: Any heavy computation in renderers?
4. **Look for redundant work**: Same calculation in multiple cells?

### Example Audit Table

| File | Columns | Inline Renderers | Memoized | Heavy Ops |
|------|---------|------------------|----------|-----------|
| referenda-columns.tsx | 15 | 3 | 0 | 0 |
| treasury-columns.tsx | 12 | 2 | 0 | 1 |
| ... | ... | ... | ... | ... |

---

## Key Questions to Answer

1. **Cell Renderers**: Are they optimized or recreated on every render?
2. **Lookups**: Are category/user lookups using Maps instead of arrays?
3. **Sorting**: Are we using immutable .toSorted()?
4. **Virtualization**: Do we need it? What's the performance with 100+ rows?
5. **TanStack Config**: Are all row models necessary?
6. **Column Hoisting**: Can static JSX be hoisted?

---

## Expected Findings Format

### Issue #1: Inline cell renderers not memoized

**Severity**: 🟡 MEDIUM
**Impact**: Unnecessary re-renders of table cells

**Location**:
- src/components/tables/referenda-columns.tsx:86-96
- src/components/tables/treasury-columns.tsx:42-48
- [8 more files...]

**Current Code**:
```tsx
export const referendaColumns = [
  {
    id: 'title',
    cell: ({ row }: { row: any }) => (
      <div className="max-w-[400px] truncate" title={row.original.title}>
        {row.original.title}
      </div>
    ),
  },
];
```

**Problem**: Cell renderer is recreated on every table render

**Recommended Fix**:
```tsx
const TitleCell = memo(function TitleCell({ title }: { title: string }) {
  return (
    <div className="max-w-[400px] truncate" title={title}>
      {title}
    </div>
  );
});

export const referendaColumns = [
  {
    id: 'title',
    cell: ({ row }: { row: any }) => <TitleCell title={row.original.title} />
  },
];
```

**Estimated Impact**:
- Reduced re-renders of cells: 40-60%
- Faster table updates when data changes

**Effort**: Medium (3-4 hours to update all column files)
**Priority**: Medium

---

### Issue #2: Category lookups using array.find() instead of Map

**Severity**: 🟠 HIGH
**Impact**: O(n) lookups on every row render

**Location**:
- CategorySelector component (need to locate)
- Any column renderer that looks up categories

**Current Pattern**:
```tsx
const category = categories.find(c => c.id === categoryId); // O(n)
```

**Problem**: If 1000 rows × 50 categories = 50,000 iterations

**Recommended Fix**:
```tsx
// Build Map once
const categoryById = useMemo(
  () => new Map(categories.map(c => [c.id, c])),
  [categories]
);

// Use Map
const category = categoryById.get(categoryId); // O(1)
```

**Estimated Impact**:
- Lookup time: 50,000 iterations → 1,000 lookups
- Faster table rendering: ~100-200ms saved

**Effort**: Low (1-2 hours to refactor)
**Priority**: High (easy fix, good impact)

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Read Core DataTable Files
- Read `data-table.tsx` completely
- Understand TanStack Table configuration
- Note row model usage

### Step 3: Audit Column Definitions
For each of the 12 column definition files:
1. Count total columns
2. Identify inline renderers
3. Check for memoization
4. Look for expensive operations

### Step 4: Check Lookup Operations
```bash
# Search for array.find() in column files
grep -rn "\.find(" src/components/tables/ --include="*.tsx"
grep -rn "\.filter(" src/components/tables/ --include="*.tsx"
```

### Step 5: Check for Mutations
```bash
# Search for .sort() without .toSorted()
grep -rn "\.sort(" src/components/data-table/ --include="*.tsx"
```

### Step 6: Performance Testing
If possible:
- Load table with 100 rows
- Check React DevTools Profiler
- Measure render time
- Identify slow cells

### Step 7: Document Findings
Create comprehensive report with:
- Cell renderer optimizations
- Lookup improvements
- Virtualization recommendation
- Sorting/filtering optimizations

---

## Success Criteria

- [ ] All DataTable files reviewed
- [ ] All 12 column definition files audited
- [ ] Inline renderers identified
- [ ] Lookup operations analyzed
- [ ] Virtualization assessment complete
- [ ] TanStack config optimized
- [ ] Findings documented with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-4-findings.md`
2. **Column Renderer Audit**: Matrix of all columns and optimizations
3. **Virtualization Recommendation**: Yes/No with justification
4. **Quick Wins List**: Easy optimizations with high impact

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 5: Chart Components & Visualizations](./chapter-5-charts.md)**

---

*Chapter Status: ⏳ Pending*
