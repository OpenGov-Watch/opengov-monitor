# Chapter 5: Chart Components & Visualizations

**Status**: ⏳ Pending
**Priority**: MEDIUM
**Estimated Time**: 1-2 hours

---

## Objective

Optimize chart components, SVG rendering, and visualization performance using Recharts library.

---

## Files to Review

### Chart Components
- `src/frontend/src/components/charts/pie-chart.tsx`
- `src/frontend/src/components/charts/bar-chart.tsx`
- `src/frontend/src/components/charts/line-chart.tsx`
- `src/frontend/src/components/charts/data-table.tsx` - Dashboard table widget
- Any other chart components in the charts/ directory

### Dashboard Integration
- `src/frontend/src/components/dashboard/dashboard-component.tsx` - Widget renderer

### Pages with Charts
- `src/frontend/src/pages/spending.tsx`
- `src/frontend/src/pages/treasury-netflows.tsx`
- Any other pages with visualizations

---

## Applicable React Best Practices

### MEDIUM Priority

#### 6.1 Animate SVG Wrapper Instead of SVG Element
**What to check**: Are chart animations/transitions animating SVG directly?

**Pattern to look for**:
```tsx
// ❌ Animating SVG directly - no hardware acceleration
<svg className="transition-transform rotate-180">
  <path d="..." />
</svg>

// ❌ Recharts with CSS animations on SVG
<PieChart className="animate-spin">...</PieChart>

// ✅ Animate wrapper div
<div className="transition-transform rotate-180">
  <svg><path d="..." /></svg>
</div>
```

**Action**: Check if any charts have CSS animations/transitions

---

#### 6.3 Hoist Static JSX Elements
**What to check**: Are chart config objects recreated every render?

**Pattern to look for**:
```tsx
// ❌ Recreated on every render
function SpendingChart({ data }) {
  return (
    <BarChart data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="value" fill="#8884d8" />
    </BarChart>
  );
}

// ✅ Static config hoisted (if data-independent)
const chartConfig = {
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
};

function SpendingChart({ data }) {
  return (
    <BarChart data={data} {...chartConfig}>
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Bar dataKey="value" fill="#8884d8" />
    </BarChart>
  );
}
```

**Note**: Chart children (XAxis, YAxis, etc.) are declarative config - React handles them efficiently. Focus on data transformations.

---

#### 6.4 Optimize SVG Precision
**What to check**: Custom SVG elements with excessive coordinate precision

**Pattern to look for**:
```tsx
// ❌ Excessive precision (8 decimals)
<path d="M 10.29384756 20.84736252 L 30.93847264 40.19283745" />

// ✅ Reasonable precision (1 decimal)
<path d="M 10.3 20.8 L 30.9 40.2" />
```

**Note**: Recharts generates SVG automatically, so this is less relevant. Check if we have custom SVG graphics.

---

### LOW-MEDIUM Priority

#### 2.4 Dynamic Imports for Heavy Components
**What to check**: Are chart components lazy-loaded?

**Current**: Recharts is ~200KB library
- Should it be in the main bundle or loaded on demand?
- Are chart pages using dynamic imports?

**Pattern to implement**:
```tsx
// If charts are only used on specific pages
const SpendingChart = dynamic(() => import('./spending-chart'), {
  loading: () => <ChartSkeleton />
});
```

**Question**: Are charts loaded on the dashboard homepage or only on specific pages?

---

#### 5.2 Extract to Memoized Components
**What to check**: Chart data transformations

**Pattern to look for**:
```tsx
// ❌ Data transformation on every render
function SpendingChart({ rawData }) {
  const chartData = rawData.map(item => ({
    name: item.category,
    value: item.amount / 1000000, // Convert to millions
    label: `${item.category}: $${(item.amount / 1000000).toFixed(2)}M`
  }));

  return <BarChart data={chartData}>...</BarChart>;
}

// ✅ Memoized transformation
function SpendingChart({ rawData }) {
  const chartData = useMemo(() =>
    rawData.map(item => ({
      name: item.category,
      value: item.amount / 1000000,
      label: `${item.category}: $${(item.amount / 1000000).toFixed(2)}M`
    })),
    [rawData]
  );

  return <BarChart data={chartData}>...</BarChart>;
}
```

---

## Recharts Performance Checklist

### Configuration Review

For each chart component, check:

1. **Data Size**
   - How many data points?
   - Any charts with 500+ points that should be sampled?

2. **Animations**
   - Are `animationDuration` values reasonable?
   - Can we disable animations in dashboard edit mode?

3. **Tooltips**
   - Are custom tooltips optimized?
   - Any heavy computation in tooltip render?

4. **Responsive**
   - Using `ResponsiveContainer`? (good)
   - Any unnecessary resize listeners?

---

## Dashboard Chart Widget Performance

### Check Dashboard Component Renderer

**Location**: `src/components/dashboard/dashboard-component.tsx`

**Questions**:
1. How are chart components loaded?
2. Are they memoized to prevent re-renders?
3. When dashboard grid updates, do all charts re-render?

**Expected pattern**:
```tsx
// ✅ Memoized widget
const ChartWidget = memo(function ChartWidget({ config }) {
  const chartData = useMemo(() => transformData(config.data), [config.data]);
  return <BarChart data={chartData} />;
});
```

---

## Color Theme & Styling

### Check for Performance Issues

**Pattern to look for**:
```tsx
// ❌ Generating colors on every render
const colors = data.map((_, i) =>
  `hsl(${(i * 360) / data.length}, 70%, 50%)`
);

// ✅ Pre-defined color palette
const COLOR_PALETTE = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
  '#d084d0', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1'
];

const colors = useMemo(() =>
  data.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]),
  [data.length]
);
```

---

## Key Questions to Answer

1. **Bundle Size**: Is Recharts lazy-loaded or in main bundle?
2. **Animations**: Are SVG elements being animated directly?
3. **Data Transformations**: Are they memoized?
4. **Dashboard Re-renders**: Do all charts re-render when one updates?
5. **Data Volume**: Any charts with excessive data points?
6. **Custom SVG**: Any custom SVG with precision issues?

---

## Expected Findings Format

### Issue #1: Recharts loaded in main bundle

**Severity**: 🟡 MEDIUM
**Impact**: +200KB to main bundle

**Location**:
- Multiple pages import Recharts directly

**Current Code**:
```tsx
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
```

**Problem**: Recharts (~200KB) loaded even if user never views charts

**Recommended Fix**: Conditional loading

**Option 1**: Lazy-load chart pages
```tsx
// router.tsx
const SpendingPage = lazy(() => import('./pages/spending'));
// Recharts only loaded when SpendingPage accessed
```

**Option 2**: Dynamic import in dashboard
```tsx
const BarChartComponent = dynamic(
  () => import('recharts').then(m => ({ default: m.BarChart })),
  { loading: () => <ChartSkeleton /> }
);
```

**Estimated Impact**:
- Bundle size reduction: 200KB (~50KB gzipped)
- Faster initial load for users who don't view charts

**Effort**: Low (1-2 hours)
**Priority**: Medium (good ROI)

---

### Issue #2: Chart data transformation not memoized

**Severity**: 🟡 MEDIUM
**Impact**: Unnecessary recalculation on every render

**Location**:
- src/components/charts/pie-chart.tsx:15-25
- src/pages/spending.tsx:42-58

**Current Code**:
```tsx
function SpendingChart({ data }) {
  // Runs on EVERY render
  const chartData = data.map(item => ({
    name: item.category,
    value: item.amount / 1000000
  }));

  return <PieChart data={chartData}>...</PieChart>;
}
```

**Problem**: Data transformation recalculated even when data hasn't changed

**Recommended Fix**:
```tsx
function SpendingChart({ data }) {
  const chartData = useMemo(() =>
    data.map(item => ({
      name: item.category,
      value: item.amount / 1000000
    })),
    [data]
  );

  return <PieChart data={chartData}>...</PieChart>;
}
```

**Estimated Impact**:
- Faster renders: ~10-20ms saved per render
- Prevents chart animation flicker

**Effort**: Low (30 minutes to add useMemo)
**Priority**: Medium

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Inventory Chart Components
```bash
# List all chart files
find src/components/charts -name "*.tsx"

# Check Recharts usage
grep -rn "from 'recharts'" src/ --include="*.tsx"
```

### Step 3: Review Each Chart Component
For each chart file:
1. Read the file completely
2. Check data transformation logic
3. Look for memoization
4. Check if SVG elements are animated
5. Note any custom SVG graphics

### Step 4: Check Dashboard Integration
- Read `dashboard-component.tsx`
- See how charts are rendered in dashboard
- Check if widgets are memoized

### Step 5: Analyze Bundle Impact
```bash
# Build and check bundle size
pnpm run build
ls -lh dist/assets/*.js

# If vite-bundle-visualizer exists:
pnpm run build --mode analyze
```

### Step 6: Document Findings
Create report with:
- Bundle size impact
- Memoization opportunities
- Lazy-loading recommendations
- Animation optimizations

---

## Success Criteria

- [ ] All chart components reviewed
- [ ] Recharts bundle impact analyzed
- [ ] Data transformations checked for memoization
- [ ] SVG animation patterns verified
- [ ] Dashboard integration reviewed
- [ ] Findings documented with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-5-findings.md`
2. **Bundle Analysis**: Recharts impact on bundle size
3. **Optimization List**: Quick wins for chart performance

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 6: UI Component Library](./chapter-6-ui-library.md)**

---

*Chapter Status: ⏳ Pending*
