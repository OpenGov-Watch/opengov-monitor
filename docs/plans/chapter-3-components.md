# Chapter 3: Component Architecture & Re-renders

**Status**: ⏳ Pending
**Priority**: HIGH
**Estimated Time**: 2-3 hours

---

## Objective

Optimize component structure, reduce unnecessary re-renders, and improve memoization strategy across the application.

---

## Files to Review

### Layout Components (4 files)
- `src/frontend/src/components/layout/Layout.tsx`
- `src/frontend/src/components/layout/sidebar.tsx`
- `src/frontend/src/components/layout/bottom-nav.tsx`
- `src/frontend/src/components/layout/mobile-header.tsx`

### Data Table System (focus on largest components)
- `src/frontend/src/components/data-table/data-table.tsx` - Main table (600+ lines)
- `src/frontend/src/components/data-table/toolbar.tsx`
- `src/frontend/src/components/data-table/pagination.tsx`
- `src/frontend/src/components/data-table/view-selector.tsx`

### Dashboard Components (3 files)
- `src/frontend/src/components/dashboard/dashboard-component.tsx`
- `src/frontend/src/components/dashboard/dashboard-grid.tsx`
- `src/frontend/src/components/dashboard/component-editor.tsx`

### Query Builder
- `src/frontend/src/components/query-builder/*.tsx` - All query builder files

### Complex Pages (top 5)
- `src/frontend/src/pages/referenda.tsx`
- `src/frontend/src/pages/dashboards/edit.tsx`
- `src/frontend/src/pages/manage/categories.tsx`
- Any other page > 200 lines

---

## Applicable React Best Practices

### HIGH Priority

#### 5.2 Extract to Memoized Components
**What to check**: Large components that should be decomposed

**Known issue**: `data-table.tsx` is 600+ lines
- Should be split into smaller memoized components
- Heavy computation should be extracted

**Pattern to look for**:
```tsx
// ❌ Large component doing everything
function DataTable() {
  const [data, setData] = useState([]);
  const processedData = useMemo(() => /* complex processing */, [data]);
  const columns = useMemo(() => /* generate columns */, []);
  const filteredData = useMemo(() => /* filtering */, [data]);
  // ... 500 more lines
}

// ✅ Extracted memoized components
const DataTableHeader = memo(function DataTableHeader({ columns }) { ... });
const DataTableBody = memo(function DataTableBody({ rows }) { ... });
const DataTableFooter = memo(function DataTableFooter({ stats }) { ... });

function DataTable() {
  // Much smaller, delegates to memo'd components
}
```

**Action**: Identify large components (>200 lines) that should be decomposed

---

#### 5.3 Narrow Effect Dependencies
**What to check**: Effects with object dependencies instead of primitives

**Pattern to look for**:
```tsx
// ❌ Object dependency - re-runs on any field change
useEffect(() => {
  console.log(user.id);
}, [user]);

// ✅ Primitive dependency - re-runs only when id changes
useEffect(() => {
  console.log(user.id);
}, [user.id]);
```

**Action**: Review all `useEffect` hooks in listed files

---

#### 5.5 Use Lazy State Initialization
**What to check**: Expensive initial state calculations

**Pattern to look for**:
```tsx
// ❌ Runs on every render
const [state, setState] = useState(expensiveComputation());
const [settings, setSettings] = useState(JSON.parse(localStorage.getItem('key')));

// ✅ Runs only once
const [state, setState] = useState(() => expensiveComputation());
const [settings, setSettings] = useState(() =>
  JSON.parse(localStorage.getItem('key') || '{}')
);
```

**Specific checks**:
- `use-view-state.ts` - Does it use lazy initialization for localStorage reads?
- Page components - Any expensive initial state?
- DataTable - Initial sorting/filtering state

---

### MEDIUM Priority

#### 5.1 Defer State Reads to Usage Point
**What to check**: Components subscribing to state they only read in callbacks

**Pattern to look for**:
```tsx
// ❌ Subscribes to all searchParams changes
function ShareButton({ id }) {
  const searchParams = useSearchParams();

  const handleShare = () => {
    const ref = searchParams.get('ref');
    shareItem(id, { ref });
  };
}

// ✅ Reads on demand, no subscription
function ShareButton({ id }) {
  const handleShare = () => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    shareItem(id, { ref });
  };
}
```

**Action**: Look for `useSearchParams()` usage

---

#### 5.4 Subscribe to Derived State
**What to check**: Components re-rendering on continuous values instead of derived booleans

**Pattern to look for**:
```tsx
// ❌ Re-renders on every pixel change (width: 767, 766, 765...)
function Sidebar() {
  const width = useWindowWidth();
  const isMobile = width < 768;
  return <nav className={isMobile ? 'mobile' : 'desktop'}>;
}

// ✅ Re-renders only when boolean changes
function Sidebar() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  return <nav className={isMobile ? 'mobile' : 'desktop'}>;
}
```

**Action**: Look for responsive layout logic in Layout/Sidebar/MobileHeader

---

#### 5.6 Use Transitions for Non-Urgent Updates
**What to check**: Frequent state updates that block UI

**Pattern to look for**:
- Table filtering/sorting - Should use transitions?
- Dashboard drag operations - Already has debounce, but should use transitions?
- Search inputs - Should use transitions

**Example**:
```tsx
// ❌ Blocks UI on every keystroke
const handleSearch = (query: string) => {
  setSearchQuery(query);
};

// ✅ Non-blocking updates
import { startTransition } from 'react';
const handleSearch = (query: string) => {
  startTransition(() => {
    setSearchQuery(query);
  });
};
```

---

## Component Size Analysis

Create a table of largest components:

| Component | Lines | Functions | Hooks | Should Split? |
|-----------|-------|-----------|-------|---------------|
| data-table.tsx | 600+ | ? | ? | Yes |
| dashboard-grid.tsx | ? | ? | ? | ? |
| ... | ... | ... | ... | ... |

---

## Re-render Analysis Plan

For critical components, use React DevTools Profiler:

1. **DataTable**
   - How often does it re-render?
   - What causes re-renders?
   - Are child components re-rendering unnecessarily?

2. **Dashboard Grid**
   - Re-render frequency during drag operations
   - Are all widgets re-rendering when one changes?

3. **Layout Components**
   - Does sidebar re-render when route changes?
   - Does header re-render on every state change?

---

## Key Questions to Answer

1. **Component Size**: Which components are >200 lines and should be split?
2. **Memoization**: Which components should use `React.memo()`?
3. **Effect Dependencies**: Are effect dependencies properly narrowed?
4. **Lazy Initialization**: Is expensive state initialization lazy?
5. **Transitions**: Should any state updates use transitions?
6. **Prop Drilling**: Is there excessive prop drilling that causes re-renders?

---

## Expected Findings Format

### Issue #1: DataTable is too large and monolithic

**Severity**: 🟠 HIGH
**Impact**: Difficult to optimize, high re-render risk

**Location**:
- src/components/data-table/data-table.tsx (600+ lines)

**Current Structure**:
```tsx
export function DataTable<TData>({ ... }: DataTableProps<TData>) {
  // VIEW STATE (40 lines)
  // COLUMN CONFIG (20 lines)
  // DATA FETCHING (60 lines)
  // BUILD QUERY CONFIG (80 lines)
  // TABLE INSTANCE (40 lines)
  // EDIT HANDLERS (100 lines)
  // RENDERING (260 lines)
}
```

**Problems**:
1. Too many responsibilities in one component
2. Difficult to optimize re-renders
3. Hard to test individual pieces
4. Large props object (14 props)

**Recommended Fix**: Split into logical subcomponents

```tsx
// Extract logical pieces
const DataTableContent = memo(function DataTableContent({ table, loading, error }) {
  // Rendering logic only
});

const DataTableEditHandlers = memo(function DataTableEditHandlers({ editConfig, onEdit }) {
  // Edit logic only
});

export function DataTable<TData>(props: DataTableProps<TData>) {
  // Orchestration only
  return (
    <>
      <DataTableToolbar />
      <DataTableContent table={table} />
      <DataTablePagination />
    </>
  );
}
```

**Estimated Impact**:
- Reduced re-renders: 40-60%
- Better performance profiling
- Easier to maintain

**Effort**: Medium (4-6 hours to refactor safely)
**Priority**: High

---

### Issue #2: Effect dependencies too broad

**Severity**: 🟡 MEDIUM
**Impact**: Unnecessary re-runs of effects

**Location**:
- Multiple files (need to audit)

**Pattern Found**:
```tsx
useEffect(() => {
  if (config.enabled) {
    doSomething();
  }
}, [config]); // ❌ Re-runs on any config change
```

**Recommended Fix**:
```tsx
useEffect(() => {
  if (config.enabled) {
    doSomething();
  }
}, [config.enabled]); // ✅ Re-runs only when enabled changes
```

**Estimated Impact**:
- Fewer effect re-runs: 30-50%
- Slightly better performance

**Effort**: Low (1-2 hours to fix all occurrences)
**Priority**: Medium

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Analyze Component Sizes
```bash
# Get line counts for all components
find src/components -name "*.tsx" -exec wc -l {} + | sort -rn | head -20
```

### Step 3: Review Large Components
- Read each component >200 lines
- Identify responsibilities
- Look for memoization opportunities
- Check effect dependencies

### Step 4: Check Lazy Initialization
```bash
# Search for useState without lazy init
grep -rn "useState(" src/ --include="*.tsx" | grep -v "() =>"
```

### Step 5: Audit Effect Dependencies
- Read all `useEffect` hooks in listed files
- Check if dependencies are objects/arrays when they could be primitives
- Document narrowing opportunities

### Step 6: Plan Component Decomposition
For large components:
- Identify logical boundaries
- Plan extraction into smaller components
- Determine which should be memo'd

### Step 7: Document Findings
Create report with:
- Component size analysis
- Re-render optimization opportunities
- Memoization recommendations
- Refactoring priorities

---

## Success Criteria

- [ ] All listed files reviewed
- [ ] Component size analysis complete
- [ ] Large components identified for splitting
- [ ] Effect dependencies audited
- [ ] Lazy initialization checked
- [ ] Memoization opportunities documented
- [ ] Findings with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-3-findings.md`
2. **Component Size Matrix**: All components >200 lines
3. **Refactoring Priorities**: Which components to split first
4. **Effect Audit**: All effects with broad dependencies

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 4: Data Table Performance](./chapter-4-data-tables.md)**

---

*Chapter Status: ⏳ Pending*
