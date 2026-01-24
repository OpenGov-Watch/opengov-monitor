"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WidthProvider, Responsive, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { DashboardComponent } from "./dashboard-component";
import type {
  DashboardComponent as DashboardComponentType,
  GridConfig,
  ChartConfig,
} from "@/lib/db/types";

import "react-grid-layout/css/styles.css";

// Simple debounce utility to prevent rapid-fire updates
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

// Define Layouts type for responsive breakpoints (Layout is already an array)
type Layouts = {
  [breakpoint: string]: Layout;
};

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  components: DashboardComponentType[];
  editable?: boolean;
  highlightComponentId?: number | null;
  onLayoutChange?: (componentId: number, gridConfig: GridConfig) => void;
  onEditComponent?: (component: DashboardComponentType) => void;
  onDuplicateComponent?: (component: DashboardComponentType) => void;
  onMoveComponent?: (component: DashboardComponentType) => void;
  onDeleteComponent?: (componentId: number) => void;
  width?: number;
}

// Responsive breakpoints and column counts
// Aligned with Tailwind breakpoints for consistent behavior
const BREAKPOINTS = { lg: 1024, md: 768, sm: 640, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 };
const ROW_HEIGHT = 80;
const GRID_MARGIN: [number, number] = [10, 10]; // [horizontal, vertical] margin between items

export function DashboardGrid({
  components,
  editable = false,
  highlightComponentId,
  onLayoutChange,
  onEditComponent,
  onDuplicateComponent,
  onMoveComponent,
  onDeleteComponent,
}: DashboardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Track container width for grid overlay
  const [containerWidth, setContainerWidth] = useState(0);

  // Track auto-calculated heights for unconstrained text components
  const [autoHeights, setAutoHeights] = useState<Record<number, number>>({});

  // Calculate required grid height from content height
  const calculateGridHeight = useCallback((contentHeight: number): number => {
    // Add padding for header (~48px) and content padding (~24px)
    const totalHeight = contentHeight + 72;
    return Math.max(2, Math.ceil(totalHeight / ROW_HEIGHT));
  }, []);

  // Handle height changes from unconstrained text components
  const handleComponentHeightChange = useCallback((componentId: number, contentHeight: number) => {
    const newGridH = calculateGridHeight(contentHeight);
    setAutoHeights(prev => {
      if (prev[componentId] === newGridH) return prev;
      return { ...prev, [componentId]: newGridH };
    });
  }, [calculateGridHeight]);

  // Track container width for grid overlay using ResizeObserver
  useEffect(() => {
    if (!gridRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0;
      setContainerWidth(width);
    });
    resizeObserver.observe(gridRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Scroll to bottom when new component is added
  useEffect(() => {
    if (highlightComponentId) {
      // Delay to allow grid layout to fully render
      const timeoutId = setTimeout(() => {
        gridRef.current?.scrollTo({
          top: gridRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [highlightComponentId, components]);

  // Create a stable signature of components to prevent unnecessary re-renders
  // This changes when any component property that affects rendering changes
  const componentSignature = useMemo(
    () => components.map((c) =>
      `${c.id}:${c.name}:${c.type}:${c.grid_config}:${c.query_config}:${c.chart_config || ''}`
    ).join("|"),
    [components]
  );

  // Sort components by spatial position (y, then x) to ensure consistent rendering order
  // This is critical for react-grid-layout to display components in the same visual order
  // in both view mode (no compaction) and edit mode (vertical compaction)
  const sortedComponents = useMemo(() => {
    return [...components].sort((a, b) => {
      const gridA: GridConfig = JSON.parse(a.grid_config);
      const gridB: GridConfig = JSON.parse(b.grid_config);

      // Sort by y-coordinate first (top to bottom)
      if (gridA.y !== gridB.y) {
        return gridA.y - gridB.y;
      }

      // If same y, sort by x-coordinate (left to right)
      return gridA.x - gridB.x;
    });
  }, [componentSignature]);

  // Convert components to grid layout for all breakpoints
  // Memoized to prevent infinite render loops
  const layouts = useMemo((): Layouts => {
    const baseLayout: LayoutItem[] = sortedComponents.map((comp) => {
      const gridConfig: GridConfig = JSON.parse(comp.grid_config);
      const chartConfig: ChartConfig = comp.chart_config ? JSON.parse(comp.chart_config) : {};

      // Check if this is an unconstrained text component with measured height
      const isUnconstrained = comp.type === "text" && chartConfig.constrainHeight === false;
      const autoHeight = autoHeights[comp.id];
      const height = isUnconstrained && autoHeight ? autoHeight : gridConfig.h;

      return {
        i: String(comp.id),
        x: gridConfig.x,
        y: gridConfig.y,
        w: gridConfig.w,
        h: height,
        minW: 2,
        minH: 2,
        static: !editable, // Static in view mode prevents movement, dynamic in edit mode allows dragging
      };
    });

    // Generate responsive layouts
    // For smaller screens, scale widths and positions proportionally to preserve side-by-side relationships
    const adjustLayout = (layout: LayoutItem[], maxCols: number, baseCols: number): LayoutItem[] => {
      const scale = maxCols / baseCols;
      return layout.map(item => ({
        ...item,
        w: Math.max(1, Math.round(item.w * scale)),
        x: Math.round(item.x * scale),
      }));
    };

    return {
      lg: baseLayout,
      md: adjustLayout(baseLayout, COLS.md, COLS.lg),
      sm: adjustLayout(baseLayout, COLS.sm, COLS.lg),
      xs: adjustLayout(baseLayout, COLS.xs, COLS.lg),
      xxs: baseLayout.map(item => ({ ...item, w: 1, x: 0 })), // Stack everything on mobile
    };
  }, [componentSignature, editable, autoHeights]);

  // Use ref to store debounced handler so it persists across renders
  const debouncedHandleLayoutChangeRef = useRef<((currentLayout: Layout, allLayouts: Partial<Record<string, Layout>>) => void) | null>(null);

  // Create the layout change handler logic
  const handleLayoutChangeLogic = useCallback(
    (currentLayout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
      if (!editable || !onLayoutChange) return;

      // Only update based on the lg (desktop) layout
      const lgLayout = allLayouts.lg || currentLayout;

      // Find changed items and update
      for (const item of lgLayout) {
        const componentId = parseInt(item.i, 10);
        const oldComponent = components.find((c) => c.id === componentId);
        if (!oldComponent) continue;

        const oldGrid: GridConfig = JSON.parse(oldComponent.grid_config);
        const hasChanged =
          oldGrid.x !== item.x ||
          oldGrid.y !== item.y ||
          oldGrid.w !== item.w ||
          oldGrid.h !== item.h;

        if (hasChanged) {
          onLayoutChange(componentId, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
      }
    },
    [components, editable, onLayoutChange]
  );

  // Update debounced handler when the logic changes
  useEffect(() => {
    debouncedHandleLayoutChangeRef.current = debounce(handleLayoutChangeLogic, 100);
  }, [handleLayoutChangeLogic]);

  // The actual handler passed to the grid - calls the debounced version
  const handleLayoutChange = useCallback(
    (currentLayout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
      debouncedHandleLayoutChangeRef.current?.(currentLayout, allLayouts);
    },
    []
  );

  if (components.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
        {editable
          ? "No components yet. Click \"Add Component\" to get started."
          : "This dashboard has no components."}
      </div>
    );
  }

  return (
    <div ref={gridRef} className="w-full h-full overflow-auto relative">
      {/* Grid overlay showing column and row boundaries in edit mode */}
      {editable && containerWidth > 0 && (() => {
        const colWidth = (containerWidth - GRID_MARGIN[0] * 2) / 12;
        const rowHeight = ROW_HEIGHT + GRID_MARGIN[1];
        return (
          <div
            className="absolute pointer-events-none z-0"
            style={{
              top: GRID_MARGIN[1],
              left: GRID_MARGIN[0],
              right: GRID_MARGIN[0],
              bottom: 0,
            }}
          >
            {/* Vertical dashed lines */}
            {Array.from({ length: 13 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: i * colWidth - 1,
                  width: 2,
                  backgroundImage: `repeating-linear-gradient(
                    to bottom,
                    hsl(var(--primary) / 0.4) 0px,
                    hsl(var(--primary) / 0.4) 6px,
                    transparent 6px,
                    transparent 12px
                  )`,
                }}
              />
            ))}
            {/* Horizontal dashed lines */}
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute left-0 right-0"
                style={{
                  top: (i + 1) * rowHeight - 1,
                  height: 2,
                  backgroundImage: `repeating-linear-gradient(
                    to right,
                    hsl(var(--primary) / 0.25) 0px,
                    hsl(var(--primary) / 0.25) 6px,
                    transparent 6px,
                    transparent 12px
                  )`,
                }}
              />
            ))}
          </div>
        );
      })()}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={GRID_MARGIN}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType={null}
        preventCollision={true}
      >
        {sortedComponents.map((component) => (
          <div
            key={component.id}
            data-component-id={component.id}
            className={`h-full ${editable ? "drag-handle" : ""} ${
              highlightComponentId === component.id ? "highlight-new" : ""
            }`}
          >
            <DashboardComponent
              component={component}
              editable={editable}
              onEdit={() => onEditComponent?.(component)}
              onDuplicate={() => onDuplicateComponent?.(component)}
              onMove={() => onMoveComponent?.(component)}
              onDelete={() => onDeleteComponent?.(component.id)}
              onHeightChange={handleComponentHeightChange}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
