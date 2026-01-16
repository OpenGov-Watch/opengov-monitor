# Chapter 8: JavaScript Performance & Utilities

**Status**: ⏳ Pending
**Priority**: LOW-MEDIUM
**Estimated Time**: 1-2 hours

---

## Objective

Review utility functions, loops, array operations, and localStorage access for micro-optimizations that add up to meaningful performance improvements.

---

## Files to Review

### Utility Files (5 files)
- `src/frontend/src/lib/utils.ts` - General utilities
- `src/frontend/src/lib/csv-parser.ts` - CSV import/export
- `src/frontend/src/lib/query-config-utils.ts` - Query builder utilities
- `src/frontend/src/lib/column-metadata.ts` - Column metadata helpers
- `src/frontend/src/lib/export.ts` - Export utilities

### Hooks
- `src/frontend/src/hooks/use-view-state.ts` - View state + localStorage

### Additional Context
- Review any helper functions in large components
- Check data transformation utilities

---

## Applicable React Best Practices

### MEDIUM Priority

#### 7.2 Build Index Maps for Repeated Lookups
**What to check**: Functions that do repeated `.find()` operations

**Pattern to look for**:
```tsx
// ❌ O(n) lookups in loop
function processItems(items: Item[], users: User[]) {
  return items.map(item => ({
    ...item,
    user: users.find(u => u.id === item.userId) // O(n) per item
  }));
}

// ✅ O(1) lookups with Map
function processItems(items: Item[], users: User[]) {
  const userById = new Map(users.map(u => [u.id, u]));
  return items.map(item => ({
    ...item,
    user: userById.get(item.userId) // O(1) per item
  }));
}
```

**Where to look**:
- `column-metadata.ts` - Any column lookups?
- `query-config-utils.ts` - Any JOIN resolution?
- CSV parser - Any ID resolution?

---

#### 7.5 Cache Storage API Calls
**What to check**: `use-view-state.ts` - localStorage caching

**Critical check**: Does this hook cache localStorage reads?

**Pattern to look for**:
```tsx
// ❌ Reads localStorage on every call
const getViewState = () => {
  return JSON.parse(localStorage.getItem('view-state') || '{}');
};

// ✅ Cached reads
const storageCache = new Map<string, any>();

const getViewState = (key: string) => {
  if (!storageCache.has(key)) {
    const stored = localStorage.getItem(key);
    storageCache.set(key, stored ? JSON.parse(stored) : {});
  }
  return storageCache.get(key);
};

// Invalidate cache when storage changes
window.addEventListener('storage', (e) => {
  if (e.key) storageCache.delete(e.key);
});
```

**Impact**: localStorage reads are synchronous and expensive (50-100ms)

---

#### 7.4 Cache Repeated Function Calls
**What to check**: Utility functions called repeatedly with same inputs

**Pattern to look for**:
```tsx
// ❌ Recalculates every time
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

// ✅ Cached results
const slugifyCache = new Map<string, string>();

export function slugify(text: string): string {
  if (!slugifyCache.has(text)) {
    slugifyCache.set(text, text.toLowerCase().replace(/\s+/g, '-'));
  }
  return slugifyCache.get(text)!;
}
```

**Where to look**:
- String formatting functions
- URL generation
- Column name transformations

---

### LOW-MEDIUM Priority

#### 7.3 Cache Property Access in Loops
**What to check**: Loops with repeated property access

**Pattern to look for**:
```tsx
// ❌ Multiple lookups per iteration
for (let i = 0; i < data.length; i++) {
  process(config.settings.timeout);
  validate(config.settings.maxRetries);
}

// ✅ Cached access
const settings = config.settings;
const { timeout, maxRetries } = settings;
const len = data.length;

for (let i = 0; i < len; i++) {
  process(timeout);
  validate(maxRetries);
}
```

**Where to look**:
- CSV parser loops
- Query config builders
- Data transformation loops

---

#### 7.6 Combine Multiple Array Iterations
**What to check**: Multiple `.map()` / `.filter()` chains

**Pattern to look for**:
```tsx
// ❌ Multiple iterations
const filtered = data.filter(item => item.active);
const mapped = filtered.map(item => ({ ...item, formatted: true }));
const sorted = mapped.sort((a, b) => a.id - b.id);

// ✅ Combined where possible
const processed = data
  .filter(item => item.active)
  .map(item => ({ ...item, formatted: true }))
  .toSorted((a, b) => a.id - b.id);

// ✅ Or single loop for complex logic
const processed = [];
for (const item of data) {
  if (item.active) {
    processed.push({ ...item, formatted: true });
  }
}
processed.sort((a, b) => a.id - b.id);
```

**Where to look**:
- Data transformation pipelines
- CSV processing
- Query result formatting

---

#### 7.7 Early Length Check for Array Comparisons
**What to check**: Array equality checks

**Pattern to look for**:
```tsx
// ❌ Always runs expensive comparison
function arraysEqual(a: any[], b: any[]): boolean {
  return JSON.stringify(a.sort()) === JSON.stringify(b.sort());
}

// ✅ Early length check
function arraysEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = a.toSorted();
  const bSorted = b.toSorted();
  return aSorted.every((val, i) => val === bSorted[i]);
}
```

---

#### 7.10 Use Loop for Min/Max Instead of Sort
**What to check**: Finding min/max values

**Pattern to look for**:
```tsx
// ❌ O(n log n) - sort entire array to find max
const latestDate = dates.sort((a, b) => b - a)[0];

// ✅ O(n) - single pass
let latestDate = dates[0];
for (let i = 1; i < dates.length; i++) {
  if (dates[i] > latestDate) {
    latestDate = dates[i];
  }
}
```

**Where to look**:
- Statistics calculations
- Data aggregation
- Date/time utilities

---

#### 7.11 Use Set/Map for O(1) Lookups
**What to check**: Membership checks with arrays

**Pattern to look for**:
```tsx
// ❌ O(n) per check
const allowedColumns = ['id', 'name', 'status', ...];
if (allowedColumns.includes(column)) { ... }

// ✅ O(1) per check
const allowedColumns = new Set(['id', 'name', 'status', ...]);
if (allowedColumns.has(column)) { ... }
```

**Where to look**:
- Column filtering
- Permission checks
- Validation logic

---

#### 7.12 Use toSorted() Instead of sort()
**What to check**: Are we mutating arrays with `.sort()`?

**Pattern to look for**:
```tsx
// ❌ Mutates original
const sorted = data.sort((a, b) => a.id - b.id);

// ✅ Creates new array
const sorted = data.toSorted((a, b) => a.id - b.id);
// OR
const sorted = [...data].sort((a, b) => a.id - b.id);
```

**Action**: Search for `.sort(` in all utility files

---

#### 7.9 Hoist RegExp Creation
**What to check**: RegExp created inside functions

**Pattern to look for**:
```tsx
// ❌ New RegExp on every call
export function sanitize(text: string): string {
  const pattern = /[^a-zA-Z0-9]/g;
  return text.replace(pattern, '');
}

// ✅ Hoisted to module scope
const SANITIZE_PATTERN = /[^a-zA-Z0-9]/g;

export function sanitize(text: string): string {
  return text.replace(SANITIZE_PATTERN, '');
}
```

**Where to look**:
- String validation functions
- Parsing utilities
- Format converters

---

## CSV Parser Performance

### Specific Checks for csv-parser.ts

1. **Large File Handling**
   - How does it handle 10,000+ row CSV?
   - Any streaming/chunking?
   - Memory efficient?

2. **Parsing Strategy**
   - Line-by-line or load entire file?
   - Any unnecessary string operations?
   - Efficient column mapping?

3. **Type Conversions**
   - Are conversions cached?
   - Any repeated parsing?

---

## use-view-state Hook Analysis

### Critical Performance Checks

**This hook is used by every data table** - must be optimized!

**Questions to answer**:
1. Is localStorage read cached?
2. Are writes debounced/throttled?
3. Is URL sync efficient?
4. Any unnecessary re-renders caused by this hook?

**Pattern to verify**:
```tsx
// ✅ Expected pattern
const storageCache = new Map();

export function useViewState(tableName: string, options) {
  // Cache localStorage reads
  const getCachedState = useCallback(() => {
    const key = `table-${tableName}`;
    if (!storageCache.has(key)) {
      const stored = localStorage.getItem(key);
      storageCache.set(key, stored ? JSON.parse(stored) : {});
    }
    return storageCache.get(key);
  }, [tableName]);

  // Debounce writes
  const saveState = useMemo(() =>
    debounce((state) => {
      const key = `table-${tableName}`;
      localStorage.setItem(key, JSON.stringify(state));
      storageCache.set(key, state);
    }, 500),
    [tableName]
  );

  // ...
}
```

---

## Key Questions to Answer

1. **localStorage Caching**: Is it cached or read synchronously every time?
2. **Repeated Lookups**: Any `.find()` in loops that should use Maps?
3. **Array Mutations**: Are we using `.sort()` or `.toSorted()`?
4. **CSV Performance**: Can it handle large files efficiently?
5. **RegExp**: Any RegExp created inside hot paths?
6. **String Operations**: Any repeated string transformations?
7. **Set/Map Usage**: Are membership checks using arrays or Sets?

---

## Expected Findings Format

### Issue #1: localStorage reads not cached

**Severity**: 🟠 HIGH
**Impact**: 50-100ms per table load (synchronous localStorage read)

**Location**:
- src/hooks/use-view-state.ts:42-48 (hypothetical)

**Current Code**:
```tsx
const loadState = () => {
  const stored = localStorage.getItem(`table-${tableName}`);
  return stored ? JSON.parse(stored) : {};
};

// Called on every render
const state = loadState();
```

**Problem**: localStorage is read synchronously on every component render

**Recommended Fix**:
```tsx
// Module-level cache
const storageCache = new Map<string, any>();

const loadState = (key: string) => {
  if (!storageCache.has(key)) {
    const stored = localStorage.getItem(key);
    storageCache.set(key, stored ? JSON.parse(stored) : {});
  }
  return storageCache.get(key);
};

// Invalidate on storage events
window.addEventListener('storage', (e) => {
  if (e.key) storageCache.delete(e.key);
});
```

**Estimated Impact**:
- Page load: 50-100ms faster per table
- 21 table pages = 1-2s total savings
- Better perceived performance

**Effort**: Low (1-2 hours)
**Priority**: High

---

### Issue #2: Array.find() in CSV parser loop

**Severity**: 🟡 MEDIUM
**Impact**: O(n²) performance on large CSV files

**Location**:
- src/lib/csv-parser.ts:85-92 (hypothetical)

**Current Code**:
```tsx
function mapColumns(rows: string[][], headers: string[]) {
  return rows.map(row => {
    const obj: any = {};
    row.forEach((value, i) => {
      const column = headers.find(h => h.index === i); // O(n) per cell!
      if (column) obj[column.name] = value;
    });
    return obj;
  });
}
```

**Problem**: If 1000 rows × 20 columns = 20,000 `.find()` calls

**Recommended Fix**:
```tsx
function mapColumns(rows: string[][], headers: string[]) {
  // Build Map once - O(n)
  const headerByIndex = new Map(headers.map(h => [h.index, h]));

  return rows.map(row => {
    const obj: any = {};
    row.forEach((value, i) => {
      const column = headerByIndex.get(i); // O(1)
      if (column) obj[column.name] = value;
    });
    return obj;
  });
}
```

**Estimated Impact**:
- Large CSV (1000 rows): 500ms → 50ms (10× faster)
- Better user experience for CSV imports

**Effort**: Low (30 minutes)
**Priority**: Medium

---

### Issue #3: Array.sort() mutations

**Severity**: 🟢 LOW
**Impact**: Potential bugs with React state

**Location**:
- src/lib/utils.ts:58 (hypothetical)

**Current Code**:
```tsx
export function sortBy(array: any[], key: string) {
  return array.sort((a, b) => a[key] - b[key]);
}
```

**Problem**: Mutates original array, can cause bugs with React props

**Recommended Fix**:
```tsx
export function sortBy(array: any[], key: string) {
  return array.toSorted((a, b) => a[key] - b[key]);
  // OR
  return [...array].sort((a, b) => a[key] - b[key]);
}
```

**Estimated Impact**:
- Prevents potential React re-render bugs
- Better immutability

**Effort**: Low (10 minutes)
**Priority**: Low

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Read All Utility Files
- Read `utils.ts`
- Read `csv-parser.ts`
- Read `query-config-utils.ts`
- Read `column-metadata.ts`
- Read `export.ts`

### Step 3: Deep-Dive into use-view-state
- Read `use-view-state.ts` completely
- Analyze localStorage usage
- Check for caching
- Verify write debouncing

### Step 4: Search for Anti-Patterns
```bash
# Find .sort() usage
grep -rn "\.sort(" src/lib/ --include="*.ts" --include="*.tsx"

# Find .find() in loops
grep -rn "\.find(" src/lib/ --include="*.ts"

# Find RegExp creation
grep -rn "new RegExp" src/lib/ --include="*.ts"

# Find localStorage access
grep -rn "localStorage\." src/ --include="*.ts" --include="*.tsx"
```

### Step 5: Analyze Hot Paths
Identify most frequently called functions:
- View state loading (every table load)
- CSV parsing (on import)
- Query config building (on table operation)
- Column metadata (every render?)

### Step 6: Check Loop Optimizations
- Look for property access in loops
- Check for array length caching
- Find combined operations opportunities

### Step 7: Document Findings
Create report with:
- localStorage caching analysis
- Loop optimizations
- Array operation improvements
- CSV parser performance
- Quick wins list

---

## Success Criteria

- [ ] All 5 utility files reviewed
- [ ] use-view-state analyzed in depth
- [ ] localStorage caching checked
- [ ] Array operations audited
- [ ] Loop optimizations identified
- [ ] CSV parser performance assessed
- [ ] Findings documented with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-8-findings.md`
2. **Hot Path Analysis**: Most critical functions to optimize
3. **Quick Wins**: Easy optimizations with measurable impact

---

## Review Complete!

After completing this chapter:
- **Return to Master Plan**: Update progress tracker
- **Consolidate Findings**: Merge all 8 chapter reports
- **Create Implementation Roadmap**: Prioritize all issues
- **Estimate Total Impact**: Bundle size, render time, LCP, TTI

---

*Chapter Status: ⏳ Pending*
