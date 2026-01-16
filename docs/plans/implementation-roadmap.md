# Performance Optimization - Implementation Roadmap

**Project**: OpenGov Monitor Frontend
**Date**: 2026-01-16
**Based On**: Master Performance Report
**Total Estimated Time**: 4-6 weeks

---

## Quick Start: Phase 1 (Critical Fixes)

**🎯 Goal**: Maximum impact with minimum effort
**⏱️ Time**: 1-2 days
**📦 Bundle Reduction**: 200-400KB (-30-50%)
**⚡ Performance Gain**: 100-200ms LCP improvement

### Task 1.1: Fix lucide-react Barrel Imports
**Priority**: 🔴 CRITICAL
**Time**: 2-4 hours
**Impact**: -200-400KB bundle size

**Steps**:

1. **Create automated transformation script** (30 minutes)
   ```bash
   # Create script: scripts/fix-lucide-imports.js
   pnpm add -D @babel/parser @babel/traverse @babel/generator
   ```

2. **Test on sample files** (30 minutes)
   - Run script on 2-3 test files
   - Verify imports work correctly
   - Check that icons render properly

3. **Apply to all files** (1 hour)
   - Run script on all 42 files (36 app + 6 UI)
   - Review changes with git diff
   - Verify no files were missed

4. **Test thoroughly** (1-2 hours)
   - Run `pnpm test` - all tests must pass
   - Manually test all pages with icons
   - Check mobile navigation
   - Verify dashboard edit mode
   - Test all dialogs and dropdowns

5. **Verify bundle size** (15 minutes)
   ```bash
   pnpm build
   # Check dist/assets/*.js sizes
   # Main bundle should be 200-400KB smaller
   ```

**Files to Update** (42 total):
```
Application Files (36):
- src/components/data-table/*.tsx (9 files)
- src/components/dashboard/*.tsx (2 files)
- src/components/query-builder/*.tsx (2 files)
- src/components/layout/*.tsx (3 files)
- src/pages/*.tsx (15 files)
- src/components/renderers/*.tsx (1 file)
- src/components/error/*.tsx (1 file)
- src/components/data-table/*.tsx (3 more files)

UI Component Files (6):
- src/components/ui/checkbox.tsx
- src/components/ui/command.tsx
- src/components/ui/dialog.tsx
- src/components/ui/dropdown-menu.tsx
- src/components/ui/select.tsx
- src/components/ui/sheet.tsx
```

**Acceptance Criteria**:
- ✅ All 42 files updated
- ✅ All tests pass
- ✅ Bundle size reduced by 200-400KB
- ✅ No visual regressions
- ✅ Icons render correctly on all pages

---

### Task 1.2: Disable Production Sourcemaps
**Priority**: 🟡 MEDIUM
**Time**: 1 minute
**Impact**: -150-250KB transfer size

**Steps**:

1. **Update vite.config.ts** (1 minute)
   ```typescript
   // vite.config.ts line 27
   build: {
     sourcemap: 'hidden', // Changed from: true
   }
   ```

2. **Test build** (2 minutes)
   ```bash
   pnpm build
   # Verify .map files are generated but not referenced
   ```

3. **Deploy** (if needed)
   - Upload sourcemaps to error tracking service
   - Verify they're not served to users

**Acceptance Criteria**:
- ✅ Sourcemaps generated as .map files
- ✅ Bundle files don't reference sourcemaps
- ✅ Transfer size reduced by 150-250KB
- ✅ Error tracking still works (if applicable)

---

### Phase 1 Success Metrics

**Before**:
- Bundle size: 800-1000KB
- LCP: ~2.5s
- TTI: ~3.5s

**After Phase 1**:
- Bundle size: 400-600KB ✅ -200-400KB
- LCP: ~2.3s ✅ -200ms
- TTI: ~3.4s ✅ -100ms

**Verification**:
```bash
# 1. Build and check sizes
pnpm build
du -sh dist/assets/*.js

# 2. Run Lighthouse
pnpm preview
# Open Chrome DevTools > Lighthouse > Run

# 3. Compare metrics
# Document in PR or issue
```

---

## Phase 2: High-Priority Deduplication

**🎯 Goal**: Eliminate redundant network requests
**⏱️ Time**: 3-5 days
**📊 Network Reduction**: 40-60%
**⚡ Performance Gain**: 100-300ms navigation

### Task 2.1: Implement SWR for Shared Data
**Priority**: 🟠 HIGH
**Time**: 1-2 days
**Impact**: -40-60% API calls

**Steps**:

1. **Install SWR** (5 minutes)
   ```bash
   pnpm add swr
   ```

2. **Create shared hooks** (2-3 hours)

   Create `src/hooks/use-shared-data.ts`:
   ```typescript
   import useSWR from 'swr';
   import { api } from '@/api/client';

   export function useCategories() {
     const { data, error, isLoading, mutate } = useSWR(
       'categories',
       () => api.categories.getAll(),
       {
         revalidateOnFocus: false,
         revalidateOnReconnect: false,
         dedupingInterval: 60000, // 1 minute
       }
     );

     return {
       categories: data || [],
       error,
       isLoading,
       mutate,
     };
   }

   export function useDashboards() {
     const { data, error, isLoading, mutate } = useSWR(
       'dashboards',
       () => fetch('/api/dashboards').then(r => r.json()),
       {
         revalidateOnFocus: false,
         revalidateOnReconnect: false,
         dedupingInterval: 60000,
       }
     );

     return {
       dashboards: data || [],
       error,
       isLoading,
       mutate,
     };
   }
   ```

3. **Migrate pages to use hooks** (3-4 hours)

   **Pages to update**:
   - `src/pages/referenda.tsx`
   - `src/pages/child-bounties.tsx`
   - `src/pages/bounties.tsx`
   - `src/pages/manage/categories.tsx`
   - `src/pages/manage/bounties.tsx`
   - `src/components/layout/sidebar.tsx`

   **Before**:
   ```tsx
   const [categories, setCategories] = useState([]);

   useEffect(() => {
     api.categories.getAll().then(setCategories);
   }, []);
   ```

   **After**:
   ```tsx
   const { categories, isLoading, error } = useCategories();
   ```

4. **Test caching behavior** (1-2 hours)
   - Navigate between pages
   - Verify categories only fetched once
   - Check Network tab in DevTools
   - Test manual refresh with mutate()

5. **Add SWRConfig provider** (30 minutes)

   In `src/main.tsx`:
   ```tsx
   import { SWRConfig } from 'swr';

   <SWRConfig value={{
     revalidateOnFocus: false,
     revalidateOnReconnect: false,
     shouldRetryOnError: false,
   }}>
     <App />
   </SWRConfig>
   ```

**Acceptance Criteria**:
- ✅ SWR hooks implemented
- ✅ 5 pages migrated
- ✅ Categories fetched once per session
- ✅ Dashboards fetched once
- ✅ Network requests reduced by 40-60%
- ✅ Navigation feels instant

---

### Task 2.2: Cache localStorage Reads
**Priority**: 🟠 HIGH
**Time**: 2-4 hours
**Impact**: 5-10ms per render

**Steps**:

1. **Cache apiBase in api-context** (1 hour)

   `src/contexts/api-context.tsx`:
   ```typescript
   // Add at module level
   let apiBaseCache: string | null = null;

   export function getApiBase(): string {
     if (apiBaseCache === null) {
       apiBaseCache = localStorage.getItem('apiBase') || DEFAULT_API_BASE;
     }
     return apiBaseCache;
   }

   export function setApiBase(newBase: string) {
     apiBaseCache = newBase;
     localStorage.setItem('apiBase', newBase);
   }
   ```

2. **Cache view state reads** (1-2 hours)

   `src/hooks/use-view-state.ts` - Check if already optimized
   - getSavedViews is already memoized with useCallback ✅
   - Verify no additional localStorage reads in render path

3. **Test invalidation** (1 hour)
   - Change API server
   - Verify cache updates
   - Test localStorage writes
   - Check React DevTools for re-renders

**Acceptance Criteria**:
- ✅ localStorage reads cached
- ✅ Cache invalidated on writes
- ✅ 5-10ms improvement per render
- ✅ No stale data issues

---

### Task 2.3: Fix Sidebar Dashboard Fetching
**Priority**: 🟠 HIGH
**Time**: 30 minutes (with SWR)
**Impact**: Eliminates redundant fetches

**Steps**:

1. **Use SWR hook in sidebar** (30 minutes)

   `src/components/layout/sidebar.tsx`:
   ```typescript
   import { useDashboards } from '@/hooks/use-shared-data';

   function Sidebar() {
     const { dashboards, isLoading } = useDashboards();
     // Remove old useEffect that fetches dashboards
   }
   ```

**Acceptance Criteria**:
- ✅ Sidebar uses SWR hook
- ✅ No redundant fetches on navigation
- ✅ Dashboards cached across pages

---

### Task 2.4: Convert Category Lookups to Map
**Priority**: 🟠 HIGH
**Time**: 2-3 hours
**Impact**: 5-20ms per editable cell interaction

**Steps**:

1. **Build category Map in editable-cells** (1 hour)

   `src/components/data-table/editable-cells.tsx`:
   ```typescript
   // Add at component level
   const categoryMap = useMemo(
     () => new Map(categories.map(c => [c.id, c])),
     [categories]
   );

   const subcategoryMap = useMemo(() => {
     const map = new Map<number, SubCategory[]>();
     for (const cat of categories) {
       for (const sub of cat.subcategories) {
         const list = map.get(cat.id) || [];
         list.push(sub);
         map.set(cat.id, list);
       }
     }
     return map;
   }, [categories]);
   ```

2. **Replace all array.find() calls** (1 hour)

   **Before**:
   ```tsx
   const current = categories.find(c => c.id === categoryId);
   ```

   **After**:
   ```tsx
   const current = categoryMap.get(categoryId);
   ```

   **Locations to update**:
   - Line 154: Initial render
   - Line 161: Sync effect
   - Line 177: Subcategory lookup
   - Line 201: Sync effect

3. **Test editable cells** (1 hour)
   - Test category selection
   - Test subcategory selection
   - Verify category changes
   - Test with 100+ categories

**Acceptance Criteria**:
- ✅ All lookups use Map.get()
- ✅ 5-20ms faster per interaction
- ✅ No regressions in functionality
- ✅ Works with large category lists

---

### Phase 2 Success Metrics

**Before**:
- API calls per page: 10-15
- Navigation time: ~500ms
- Editable cell response: ~50ms

**After Phase 2**:
- API calls per page: 5-8 ✅ -40-60%
- Navigation time: ~200ms ✅ -300ms
- Editable cell response: ~30-45ms ✅ -5-20ms

**Verification**:
```bash
# 1. Check Network tab
# - Navigate between pages
# - Count API calls
# - Verify deduplication

# 2. Profile with React DevTools
# - Record interactions
# - Check re-render counts
# - Measure timing

# 3. Test editable cells
# - Open category dropdown
# - Measure response time
# - Verify smooth interaction
```

---

## Phase 3: Medium-Priority Optimizations

**🎯 Goal**: Polish and refine
**⏱️ Time**: 5-7 days
**⚡ Performance Gain**: 50-100ms cumulative

### Quick Win Tasks

#### Task 3.1: Optimize Google Fonts (1 hour)
```html
<!-- Move to index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      media="print"
      onload="this.media='all'">
```

#### Task 3.2: Add Memoization (2-3 hours)
- Memoize computed lists in editable-cells
- Memoize CustomTooltip in chart files
- Memoize pie chart total calculation

#### Task 3.3: Use toSorted() (1-2 hours)
- Find all .sort() calls
- Replace with .toSorted()
- Test sorting behavior

#### Task 3.4: Add content-visibility (2-4 hours)
```css
/* Add to table styles */
.table-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 48px;
}
```

---

## Phase 4: Dashboard Polish

**🎯 Goal**: Refine dashboard system
**⏱️ Time**: 3-4 days

### Task 4.1: Memoize Dashboard Operations (2-3 hours)
- Memoize JSON.parse in ComponentEditor
- Memoize chart transform functions
- Fix useEffect sync loop

### Task 4.2: Decompose ComponentEditor (1 day)
- Extract ChartOptions component
- Extract ChartPreview component
- Test functionality

---

## Phase 5: Low-Priority Polish (Optional)

**🎯 Goal**: Micro-optimizations
**⏱️ Time**: 1-2 days

### Task 5.1: Optimize CSV Parsers (1-2 days)
- Cache length in loops
- Combine map-filter operations
- Test on large CSV imports

---

## Testing Checklist

### Before Starting
- [ ] Run baseline Lighthouse audit
- [ ] Document current bundle sizes
- [ ] Count API calls per page
- [ ] Profile with React DevTools

### After Each Phase
- [ ] Run `pnpm test` - all tests pass
- [ ] Run `pnpm build` - verify bundle size
- [ ] Test all major user flows
- [ ] Verify editable cells work
- [ ] Check dashboard editing
- [ ] Test CSV imports
- [ ] Run Lighthouse audit
- [ ] Compare metrics to baseline

### Final Verification
- [ ] Bundle size reduced by 200-400KB
- [ ] LCP improved by 100-200ms
- [ ] API calls reduced by 40-60%
- [ ] No visual regressions
- [ ] All features work correctly

---

## Risk Mitigation

### High Risk Items
1. **lucide-react imports**: Test thoroughly, icons are used everywhere
2. **SWR migration**: Verify caching behavior, test edge cases
3. **content-visibility**: May cause layout issues, test extensively

### Rollback Plan
- Each phase should be a separate PR
- Test in staging before production
- Keep feature flags for major changes
- Document rollback procedures

### Communication
- Update team on progress weekly
- Document breaking changes
- Add migration guide for SWR hooks
- Update CONTRIBUTING.md with new patterns

---

## Success Criteria

### Phase 1 (Critical)
- ✅ Bundle size: 400-600KB (was 800-1000KB)
- ✅ LCP: < 2.3s (was ~2.5s)
- ✅ All tests pass
- ✅ No visual regressions

### Phase 2 (High Priority)
- ✅ API calls: 5-8 per page (was 10-15)
- ✅ Navigation: < 200ms (was ~500ms)
- ✅ Editable cells: < 45ms (was ~50ms)

### Overall (All Phases)
- ✅ Bundle: 400-600KB (-30-50%)
- ✅ LCP: < 2.0s (-20%)
- ✅ TTI: < 3.0s (-14%)
- ✅ Lighthouse: > 90 score
- ✅ No regressions

---

## Maintenance

### Ongoing Monitoring
- Add bundle size check to CI/CD
- Monitor API call patterns
- Track Lighthouse scores
- Review new dependencies

### Code Review Checklist
- [ ] No lucide-react barrel imports
- [ ] SWR used for shared data
- [ ] Map used for O(1) lookups
- [ ] Expensive computations memoized
- [ ] Effect dependencies narrow

### Quarterly Reviews
- Run full performance audit
- Check for new optimization opportunities
- Review dependency updates
- Update documentation

---

**Last Updated**: 2026-01-16
**Next Review**: 2026-04-16

