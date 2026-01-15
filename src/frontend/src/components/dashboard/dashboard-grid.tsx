"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WidthProvider, Responsive, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { DashboardComponent } from "./dashboard-component";
import type {
  DashboardComponent as DashboardComponentType,
  GridConfig,
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
  onDeleteComponent?: (componentId: number) => void;
  width?: number;
}

// Responsive breakpoints and column counts
// lg breakpoint lowered to 800 to work with typical dashboard container widths (~1000-1200px)
const BREAKPOINTS = { lg: 800, md: 600, sm: 480, xs: 320, xxs: 0 };
const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 };
const ROW_HEIGHT = 80;

export function DashboardGrid({
  components,
  editable = false,
  highlightComponentId,
  onLayoutChange,
  onEditComponent,
  onDuplicateComponent,
  onDeleteComponent,
}: DashboardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure container width on mount and when it changes
  useEffect(() => {
    if (!gridRef.current) return;

    const measureWidth = () => {
      if (gridRef.current) {
        setContainerWidth(gridRef.current.offsetWidth);
      }
    };

    // Measure initially
    measureWidth();

    // Remeasure on window resize
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
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
  // This only changes when component IDs or grid_config values actually change,
  // not when the components array reference changes
  const componentSignature = useMemo(
    () => components.map((c) => `${c.id}:${c.grid_config}`).join("|"),
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
      return {
        i: String(comp.id),
        x: gridConfig.x,
        y: gridConfig.y,
        w: gridConfig.w,
        h: gridConfig.h,
        minW: 2,
        minH: 2,
        static: !editable, // Static in view mode prevents movement, dynamic in edit mode allows dragging
      };
    });

    // Generate responsive layouts
    // For smaller screens, adjust width to fit within column constraints
    const adjustLayout = (layout: LayoutItem[], maxCols: number): LayoutItem[] => {
      return layout.map(item => ({
        ...item,
        w: Math.min(item.w, maxCols),
        x: Math.min(item.x, Math.max(0, maxCols - item.w)),
      }));
    };

    return {
      lg: baseLayout,
      md: adjustLayout(baseLayout, COLS.md),
      sm: adjustLayout(baseLayout, COLS.sm),
      xs: adjustLayout(baseLayout, COLS.xs),
      xxs: baseLayout.map(item => ({ ...item, w: 1, x: 0 })), // Stack everything on mobile
    };
  }, [componentSignature, editable]);

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
    <div ref={gridRef} className="w-full h-full overflow-auto">
      <ResponsiveGridLayout
        key={`grid-${containerWidth}`}
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType={editable ? "vertical" : null}
        preventCollision={false}
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
              onDelete={() => onDeleteComponent?.(component.id)}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
