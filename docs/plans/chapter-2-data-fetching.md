# Chapter 2: Data Fetching & API Client

**Status**: ⏳ Pending
**Priority**: CRITICAL
**Estimated Time**: 2-3 hours

---

## Objective

Review data fetching architecture to eliminate request waterfalls, implement deduplication, and optimize caching strategies.

---

## Files to Review

### API Client (2 files)
- `src/frontend/src/api/client.ts` - API wrapper with 55+ endpoints
- `src/frontend/src/contexts/api-context.tsx` - API server switching

### State Management (2 files)
- `src/frontend/src/contexts/auth-context.tsx` - Auth state
- `src/frontend/src/hooks/use-view-state.ts` - Table state + localStorage

### All Pages (21 files)
Review data fetching patterns in each page:
- `src/frontend/src/pages/referenda.tsx`
- `src/frontend/src/pages/treasury.tsx`
- `src/frontend/src/pages/child-bounties.tsx`
- `src/frontend/src/pages/fellowship.tsx`
- `src/frontend/src/pages/fellowship-salary-cycles.tsx`
- `src/frontend/src/pages/fellowship-salary-claimants.tsx`
- `src/frontend/src/pages/spending.tsx`
- `src/frontend/src/pages/outstanding-claims.tsx`
- `src/frontend/src/pages/expired-claims.tsx`
- `src/frontend/src/pages/treasury-netflows.tsx`
- `src/frontend/src/pages/manage/*.tsx` (6 files)
- `src/frontend/src/pages/dashboards/*.tsx` (3 files)

---

## Applicable React Best Practices

### CRITICAL Priority

#### 1.4 Promise.all() for Independent Operations
**What to check**: Pages that fetch multiple independent data sources

**Current pattern observed**:
```tsx
// referenda.tsx - Line 27-28
useEffect(() => {
  api.categories.getAll().then((res) => setCategories(res as Category[]));
}, []);
```

**Question**: Are there pages that fetch multiple things sequentially?

**Pattern to look for**:
```tsx
// ❌ Sequential fetching (waterfall)
useEffect(() => {
  api.categories.getAll().then(setCategories);
  api.referenda.getAll().then(setReferenda);
}, []);

// ✅ Parallel fetching
useEffect(() => {
  Promise.all([
    api.categories.getAll(),
    api.referenda.getAll()
  ]).then(([categories, referenda]) => {
    setCategories(categories);
    setReferenda(referenda);
  });
}, []);
```

**Action**: Review every page's `useEffect` data fetching

---

### HIGH Priority

#### 4.2 Use SWR for Automatic Deduplication
**What to check**: Do multiple components fetch the same data?

**Current architecture**: Basic fetch in `api/client.ts`
```tsx
async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  // ... error handling
  return response.json();
}
```

**Problems**:
1. No automatic deduplication - if 3 components call same API, 3 requests sent
2. No caching - same data fetched repeatedly
3. No automatic revalidation
4. No optimistic updates

**Questions to answer**:
1. Do multiple components fetch categories?
2. Is user data fetched in multiple places?
3. Are dashboard widgets fetching redundantly?

**Recommended solution**: Consider implementing SWR or React Query

**Example migration**:
```tsx
// Current (no deduplication)
const [categories, setCategories] = useState<Category[]>([]);
useEffect(() => {
  api.categories.getAll().then(setCategories);
}, []);

// With SWR (automatic deduplication + caching)
import useSWR from 'swr';
const { data: categories } = useSWR('/categories', () => api.categories.getAll());
```

---

#### 7.5 Cache Storage API Calls
**What to check**: `use-view-state.ts` - Does it cache localStorage reads?

**Location**: `src/frontend/src/hooks/use-view-state.ts`

**Current pattern** (need to verify):
```tsx
// If this pattern exists, it's inefficient:
const getStoredState = () => {
  return JSON.parse(localStorage.getItem('view-state') || '{}');
};
```

**Should be** (cached):
```tsx
const storageCache = new Map<string, any>();

const getStoredState = (key: string) => {
  if (!storageCache.has(key)) {
    const stored = localStorage.getItem(key);
    storageCache.set(key, stored ? JSON.parse(stored) : {});
  }
  return storageCache.get(key);
};
```

**Impact**: localStorage reads are synchronous and expensive (50-100ms)

---

#### 7.4 Cache Repeated Function Calls
**What to check**: Are API calls cached within a component's lifecycle?

**Example scenario**:
- DataTable might call `api.categories.getAll()` multiple times during filtering/sorting
- Should cache the result

**Pattern to look for**:
```tsx
// ❌ Called on every filter change
const handleFilter = () => {
  api.categories.getAll().then(/* ... */);
};

// ✅ Cached result
const categoriesCache = useRef<Category[] | null>(null);
const getCategories = async () => {
  if (!categoriesCache.current) {
    categoriesCache.current = await api.categories.getAll();
  }
  return categoriesCache.current;
};
```

---

### MEDIUM Priority

#### 4.1 Deduplicate Global Event Listeners
**What to check**: Are there global event listeners in hooks?

**Search for**:
- `window.addEventListener`
- `document.addEventListener`
- Multiple components using same listener

**Example issue**:
```tsx
// If this exists in multiple components:
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

**Should use**: `useSWRSubscription` for shared listeners

---

## Key Questions to Answer

1. **Waterfalls**: Are there pages with sequential API calls?
2. **Duplication**: Do components fetch same data independently?
3. **Caching**: Is localStorage access cached in memory?
4. **Stale Data**: How long does data stay fresh? Any revalidation?
5. **Loading States**: Are loading states properly managed?
6. **Error Handling**: Is error handling consistent?
7. **SWR/React Query**: Would adopting a data fetching library help?

---

## Data Flow Audit

For each of the 21 pages, document:

| Page | Fetches | Sequential? | Deduplicated? | Cached? |
|------|---------|-------------|---------------|---------|
| referenda | categories | ❌ | ❌ | ❌ |
| treasury | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

---

## Expected Findings Format

### Issue #1: Sequential API calls cause waterfall

**Severity**: 🔴 CRITICAL
**Impact**: 2x slower page load

**Location**:
- src/pages/manage/categories.tsx:24-32

**Current Code**:
```tsx
useEffect(() => {
  api.categories.getAll().then(setCategories);
  api.bounties.getAll().then(setBounties);
}, []);
```

**Problem**: Bounties waits for categories to complete (waterfall)

**Recommended Fix**:
```tsx
useEffect(() => {
  Promise.all([
    api.categories.getAll(),
    api.bounties.getAll()
  ]).then(([categories, bounties]) => {
    setCategories(categories);
    setBounties(bounties);
  });
}, []);
```

**Estimated Impact**:
- Page load time: 500ms → 250ms (50% faster)
- Reduced network wait time by eliminating waterfall

**Effort**: Low (5 minutes per page, ~21 pages)
**Priority**: Fix immediately

---

### Issue #2: No request deduplication across components

**Severity**: 🟠 HIGH
**Impact**: Redundant network requests

**Location**:
- Multiple pages fetch categories independently
- Dashboard widgets may fetch same data

**Current Architecture**:
- Each component calls `api.categories.getAll()`
- No deduplication layer
- Same data fetched 5-10 times on dashboard page

**Recommended Fix**: Implement SWR or React Query

**Example with SWR**:
```tsx
// Create a fetcher
const fetcher = (url: string) => api.categories.getAll();

// In components
import useSWR from 'swr';
const { data: categories, error, isLoading } = useSWR('/categories', fetcher);
```

**Benefits**:
- Automatic request deduplication
- Built-in caching with configurable TTL
- Automatic revalidation
- Optimistic updates
- Better loading/error states

**Estimated Impact**:
- Network requests: -50% (deduplication)
- Perceived performance: 30% faster (cache hits)

**Effort**: High (1-2 days to refactor all pages)
**Priority**: High - significant impact, worth the effort

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Analyze API Client
- Read `api/client.ts` completely
- Map all 55+ endpoints
- Identify which endpoints are most frequently called

### Step 3: Audit Page Data Fetching
For each of the 21 pages:
1. Read the page file
2. Identify all API calls in useEffect
3. Check if sequential or parallel
4. Note which data is fetched

### Step 4: Check for Duplication
- Create a list of all API endpoints used
- Note which pages fetch the same data
- Identify duplication opportunities

### Step 5: Review localStorage Usage
- Read `use-view-state.ts`
- Check if localStorage reads are cached
- Look for performance issues

### Step 6: Document Findings
Create comprehensive report with:
- All waterfalls found
- Duplication patterns
- Caching opportunities
- SWR/React Query recommendation

---

## Success Criteria

- [ ] All 21 pages reviewed for data fetching
- [ ] API client architecture analyzed
- [ ] Waterfalls identified
- [ ] Duplication patterns documented
- [ ] localStorage caching checked
- [ ] SWR/React Query recommendation made
- [ ] Findings documented with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-2-findings.md`
2. **Data Flow Diagram**: Visual map of API calls per page
3. **Duplication Matrix**: Which endpoints are called by which components
4. **SWR Migration Plan**: If recommended

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 3: Component Architecture & Re-renders](./chapter-3-components.md)**

---

*Chapter Status: ⏳ Pending*
