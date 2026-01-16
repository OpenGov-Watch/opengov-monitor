# Chapter 7: Dashboard System & Grid Layout

**Status**: ⏳ Pending
**Priority**: MEDIUM
**Estimated Time**: 1-2 hours

---

## Objective

Optimize react-grid-layout performance, reduce re-renders during drag operations, and ensure dashboard widgets are properly isolated.

---

## Files to Review

### Dashboard Components (3 files)
- `src/frontend/src/components/dashboard/dashboard-grid.tsx` - Grid layout logic
- `src/frontend/src/components/dashboard/dashboard-component.tsx` - Widget renderer
- `src/frontend/src/components/dashboard/component-editor.tsx` - Component configuration editor

### Dashboard Pages (3 files)
- `src/frontend/src/pages/dashboards/index.tsx` - Dashboard list
- `src/frontend/src/pages/dashboards/view.tsx` - View mode
- `src/frontend/src/pages/dashboards/edit.tsx` - Edit mode

---

## Applicable React Best Practices

### HIGH Priority

#### 5.2 Extract to Memoized Components
**What to check**: Are dashboard widgets properly memoized?

**Current observation** (from earlier read):
```tsx
// dashboard-grid.tsx:74-78
const componentSignature = useMemo(
  () => components.map((c) => `${c.id}:${c.grid_config}:${c.query_config}`).join("|"),
  [components]
);
```

✅ Good! Already using component signature memoization.

**Additional checks**:
1. Is `DashboardComponent` memoized?
2. Do widgets re-render when grid layout changes?
3. Are chart/table widgets in the dashboard properly isolated?

**Pattern to verify**:
```tsx
// ✅ Expected pattern
const DashboardWidget = memo(function DashboardWidget({ component }) {
  // Widget content
});

// In grid
{components.map(component => (
  <div key={component.id}>
    <DashboardWidget component={component} />
  </div>
))}
```

---

#### 5.6 Use Transitions for Non-Urgent Updates
**What to check**: Dashboard grid updates during drag operations

**Current observation** (from earlier read):
```tsx
// dashboard-grid.tsx:14-23
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

✅ Good! Debounce already implemented.

**Additional check**: Should grid position updates use transitions?
```tsx
// Recommended pattern
import { startTransition } from 'react';

const handleLayoutChange = (newLayout: Layout[]) => {
  startTransition(() => {
    setLayout(newLayout);
  });
};
```

**Benefits**: Keeps UI responsive during drag operations

---

### MEDIUM Priority

#### 7.1 Batch DOM CSS Changes
**What to check**: Drag-and-drop operations

**Pattern to look for**:
```tsx
// ❌ Multiple style changes
element.style.top = '10px';
element.style.left = '20px';
element.style.width = '300px';

// ✅ Batched via CSS class or cssText
element.className = 'dragging-state';
// OR
element.style.cssText = 'top: 10px; left: 20px; width: 300px;';
```

**Note**: react-grid-layout handles this internally, but check if we have custom drag logic

---

#### 8.1 Store Event Handlers in Refs
**What to check**: Drag event handlers

**Pattern to look for**:
```tsx
// ❌ Re-subscribes on every callback change
useEffect(() => {
  const handleDrag = () => onDragEnd(itemId);
  element.addEventListener('dragend', handleDrag);
  return () => element.removeEventListener('dragend', handleDrag);
}, [onDragEnd, itemId]);

// ✅ Stable subscription with ref
const handleDragRef = useRef(onDragEnd);
useEffect(() => {
  handleDragRef.current = onDragEnd;
}, [onDragEnd]);

useEffect(() => {
  const handleDrag = () => handleDragRef.current(itemId);
  element.addEventListener('dragend', handleDrag);
  return () => element.removeEventListener('dragend', handleDrag);
}, [itemId]);
```

---

## Dashboard Widget Isolation

### Check Re-render Propagation

**Key Question**: When grid layout changes, do all widgets re-render or just the moved widget?

**Test scenario**:
1. Dashboard with 5 widgets
2. User drags one widget
3. Expected: Only dragged widget re-renders
4. Actual: Need to verify

**Verification method**:
```tsx
// Add to each widget
const renderCount = useRef(0);
useEffect(() => {
  renderCount.current++;
  console.log(`Widget ${component.id} rendered ${renderCount.current} times`);
});
```

---

## react-grid-layout Configuration

### Review Current Configuration

**From earlier read** (dashboard-grid.tsx:45-46):
```tsx
const BREAKPOINTS = { lg: 800, md: 600, sm: 480, xs: 320, xxs: 0 };
const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 };
const ROW_HEIGHT = 80;
```

**Questions**:
1. Are breakpoints optimal?
2. Is row height appropriate?
3. Should we add more responsive breakpoints?

### Check Grid Props

Look for:
- `compactType` - "vertical" in edit mode?
- `preventCollision` - Should be false for compaction
- `isDraggable` / `isResizable` - Properly toggled based on edit mode?
- `onLayoutChange` - Debounced? ✅ (confirmed earlier)

---

## Widget Loading Performance

### Check Widget Types

Dashboard can render:
- **Tables** (DataTable component)
- **Charts** (Recharts components)
- **Text** (Markdown)

**Questions**:
1. Are table widgets using same DataTable component as pages?
2. If so, are they properly optimized for dashboard context?
3. Do chart widgets load Recharts lazily?

**Pattern to check**:
```tsx
// dashboard-component.tsx
const renderWidget = (type: string) => {
  switch (type) {
    case 'table':
      return <DataTable ... />; // Should be memoized
    case 'chart':
      return <ChartWidget ... />; // Should lazy-load Recharts
    case 'text':
      return <MarkdownWidget ... />; // Should lazy-load react-markdown
  }
};
```

---

## Grid Layout Scroll Performance

### Check Scroll Container

**From earlier read** (dashboard-grid.tsx:61-72):
```tsx
useEffect(() => {
  if (highlightComponentId) {
    const timeoutId = setTimeout(() => {
      gridRef.current?.scrollTo({
        top: gridRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }
}, [highlightComponentId, components]);
```

**Questions**:
1. Is smooth scrolling causing performance issues?
2. Should we use `scrollIntoView` instead?
3. Any scroll event listeners that should be throttled?

---

## Key Questions to Answer

1. **Widget Memoization**: Are dashboard widgets properly memoized?
2. **Re-render Isolation**: When grid updates, do all widgets re-render?
3. **Drag Performance**: Is dragging smooth with 10+ widgets?
4. **Transitions**: Should layout updates use React transitions?
5. **Widget Loading**: Are heavy widget types (tables, charts) lazy-loaded?
6. **Scroll Performance**: Any scroll-related performance issues?

---

## Expected Findings Format

### Issue #1: Dashboard widgets not memoized

**Severity**: 🟠 HIGH
**Impact**: All widgets re-render on any layout change

**Location**:
- src/components/dashboard/dashboard-grid.tsx:150-170 (hypothetical)

**Current Code**:
```tsx
{sortedComponents.map((component) => (
  <div key={component.id}>
    <DashboardComponent component={component} />
  </div>
))}
```

**Problem**: `DashboardComponent` re-renders on every grid update

**Recommended Fix**:
```tsx
// Memoize the widget component
const DashboardWidget = memo(
  function DashboardWidget({ component }: { component: DashboardComponentType }) {
    return <DashboardComponent component={component} />;
  },
  (prev, next) => {
    // Only re-render if component data changed
    return prev.component.id === next.component.id &&
           prev.component.grid_config === next.component.grid_config &&
           prev.component.query_config === next.component.query_config;
  }
);

// In grid
{sortedComponents.map((component) => (
  <div key={component.id}>
    <DashboardWidget component={component} />
  </div>
))}
```

**Estimated Impact**:
- Reduced re-renders: 80-90%
- Smoother drag operations
- Better performance with many widgets

**Effort**: Low (1-2 hours)
**Priority**: High

---

### Issue #2: Layout changes should use transitions

**Severity**: 🟡 MEDIUM
**Impact**: UI can feel sluggish during drag operations

**Location**:
- src/components/dashboard/dashboard-grid.tsx:130-140 (hypothetical)

**Current Code**:
```tsx
const handleLayoutChange = (newLayout: Layout[]) => {
  debouncedLayoutChange(newLayout);
};
```

**Problem**: Layout state updates block UI during drag

**Recommended Fix**:
```tsx
import { startTransition } from 'react';

const handleLayoutChange = (newLayout: Layout[]) => {
  startTransition(() => {
    debouncedLayoutChange(newLayout);
  });
};
```

**Estimated Impact**:
- More responsive drag operations
- UI stays interactive during layout updates

**Effort**: Low (30 minutes)
**Priority**: Medium

---

## How to Execute This Chapter

### Step 1: Load React Best Practices
```
Load skill: react-best-practices
```

### Step 2: Read Dashboard Files Completely
- Read `dashboard-grid.tsx` (already partially read earlier)
- Read `dashboard-component.tsx`
- Read `component-editor.tsx`
- Read dashboard pages (view/edit)

### Step 3: Analyze Widget Memoization
- Check if `DashboardComponent` uses `memo()`
- Look at component comparison logic
- Verify widget isolation

### Step 4: Review Grid Configuration
- Check react-grid-layout props
- Verify debounce implementation
- Look for transition opportunities

### Step 5: Test Re-render Behavior (if possible)
- Load dashboard with multiple widgets
- Use React DevTools Profiler
- Drag a widget and observe re-renders

### Step 6: Check Widget Loading
- See how different widget types are loaded
- Verify lazy-loading for heavy components
- Check memoization of widget renderers

### Step 7: Document Findings
Create report with:
- Widget memoization analysis
- Re-render patterns
- Grid configuration review
- Optimization recommendations

---

## Success Criteria

- [ ] All 6 dashboard files reviewed
- [ ] Widget memoization verified
- [ ] Re-render isolation checked
- [ ] Grid configuration analyzed
- [ ] Transition opportunities identified
- [ ] Widget loading patterns reviewed
- [ ] Findings documented with impact estimates
- [ ] Master plan updated

---

## Deliverables

1. **Findings Report**: `chapter-7-findings.md`
2. **Re-render Analysis**: Widget isolation verification
3. **Optimization Checklist**: Priority improvements

---

## Next Chapter

After completing this chapter, proceed to:
**[Chapter 8: JavaScript Performance & Utilities](./chapter-8-js-performance.md)**

---

*Chapter Status: ⏳ Pending*
