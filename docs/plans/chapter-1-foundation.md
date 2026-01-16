# Chapter 1: Foundation & Build System

**Status**: ⏳ Pending
**Priority**: CRITICAL
**Estimated Time**: 1-2 hours

---

## Objective

Review build configuration, routing, and core infrastructure to identify bundle size optimization opportunities and improve code splitting strategy.

---

## Files to Review

### Build Configuration (3 files)
- `vite.config.ts` - Vite build config
- `tsconfig.json` - TypeScript settings
- `package.json` - Dependencies analysis

### Routing & Entry (3 files)
- `src/frontend/src/router.tsx` - Route definitions and lazy loading
- `src/frontend/src/main.tsx` - App entry point
- `src/frontend/src/globals.css` - Global styles and imports

---

## Applicable React Best Practices

### CRITICAL Priority

#### 2.1 Avoid Barrel File Imports
**What to check**: Search entire codebase for imports from these libraries:
- `lucide-react` - Icon library (1,583 modules)
- `@radix-ui/react-*` - UI primitives
- `@tanstack/react-table` - Table library
- `react-router` (check if using barrel or direct)

**How to check**:
```bash
# Search for barrel imports
grep -r "from 'lucide-react'" src/
grep -r "from '@radix-ui" src/
grep -r "from '@tanstack/react-table'" src/
```

**Expected finding**: Likely using barrel imports everywhere

**Correct pattern**:
```tsx
// ❌ Wrong - loads entire library
import { Check, X } from 'lucide-react'

// ✅ Correct - direct import
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
```

#### 2.4 Dynamic Imports for Heavy Components
**What to check**: Are heavy libraries lazy-loaded?
- `recharts` (~200KB) - Chart library
- `react-grid-layout` (~150KB) - Dashboard grid
- `react-markdown` (~50KB) - Markdown rendering
- `yaml` - YAML parser

**Where to check**:
- `src/router.tsx` - Are routes properly lazy-loaded?
- Dashboard pages - Is grid layout dynamically imported?
- Chart components - Are charts lazy-loaded?

**Current pattern** (from earlier exploration):
```tsx
// routes.tsx uses React.lazy() for pages - ✅ GOOD
const ReferendaPage = lazy(() => import("./pages/referenda"))
```

**Check if missing**: Heavy libraries should also be dynamically imported

#### 2.2 Conditional Module Loading
**What to check**: Are features loaded only when activated?
- Dashboard edit mode - Should grid layout load only in edit mode?
- Chart components - Load only when chart type selected?
- CSV parser - Load only when import/export clicked?

**Expected pattern**:
```tsx
// Load CSV parser on demand
const handleExport = async () => {
  const { exportToCsv } = await import('@/lib/csv-parser')
  exportToCsv(data)
}
```

#### 2.3 Defer Non-Critical Third-Party Libraries
**What to check**: Are analytics/error tracking in the critical path?
- Search `package.json` for: sentry, analytics, tracking, logging
- Check if loaded in `main.tsx` or index.html

**Should be**: Loaded after hydration with dynamic import

---

### HIGH Priority

#### 2.5 Preload Based on User Intent
**What to check**: Route prefetching strategy
- Can we preload next likely route on hover?
- Are dashboard widgets preloaded based on viewport?

**Pattern to implement**:
```tsx
<Link to="/referenda" onMouseEnter={() => import('./pages/referenda')}>
  Referenda
</Link>
```

---

## Key Questions to Answer

1. **Barrel Imports**: How many barrel imports exist across the app?
2. **Bundle Analysis**: What's the current bundle size breakdown?
3. **Lazy Loading**: Are all routes properly code-split?
4. **Heavy Dependencies**: Which libraries should be dynamically imported?
5. **Critical Path**: What's loaded immediately vs. deferred?

---

## Expected Findings Format

For each issue found:

```markdown
### Issue #1: Barrel imports from lucide-react

**Severity**: 🔴 CRITICAL
**Impact**: Bundle size increase ~500KB, slower initial load

**Location**:
- src/components/ui/button.tsx:3
- src/components/layout/sidebar.tsx:5
- [15 more files...]

**Current Code**:
```tsx
import { Check, X, Menu } from 'lucide-react'
```

**Recommended Fix**:
```tsx
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

**Estimated Impact**:
- Bundle size reduction: ~400KB (gzipped ~100KB)
- Faster dev HMR: ~2-3s improvement
- Faster production cold starts: ~200-300ms

**Effort**: Medium (2-3 hours to update all imports)
**Priority**: Fix immediately (high impact, medium effort)
```

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Analyze Package Dependencies
```bash
# Read package.json to see all dependencies
cat package.json

# Check bundle size
pnpm run build
du -sh dist/
```

### Step 3: Search for Barrel Imports
```bash
# lucide-react imports
grep -rn "from 'lucide-react'" src/ --include="*.tsx" --include="*.ts"

# Radix UI imports
grep -rn "from '@radix-ui" src/ --include="*.tsx" --include="*.ts"

# Count occurrences
grep -r "from 'lucide-react'" src/ | wc -l
```

### Step 4: Review Route Configuration
- Read `src/router.tsx` completely
- Verify all routes use React.lazy()
- Check for heavy components in critical path

### Step 5: Check Build Config
- Read `vite.config.ts`
- Look for optimization settings
- Check if code splitting is optimal

### Step 6: Document Findings
Create findings report with:
- All issues found
- Severity ratings
- Code examples
- Estimated impact
- Recommended priority

---

## Success Criteria

- [ ] All 6 files reviewed
- [ ] Barrel imports identified and counted
- [ ] Heavy dependencies catalogued
- [ ] Route lazy-loading verified
- [ ] Build configuration analyzed
- [ ] Findings documented with severity + impact
- [ ] Quick wins identified
- [ ] Master plan updated with summary

---

## Deliverables

1. **Findings Report**: `chapter-1-findings.md`
2. **Issue Count**: Total issues by severity
3. **Quick Wins List**: Fixes that can be done in < 1 day
4. **Bundle Analysis**: Current size + estimated reduction

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 2: Data Fetching & API Client](./chapter-2-data-fetching.md)**

---

*Chapter Status: ⏳ Pending*
