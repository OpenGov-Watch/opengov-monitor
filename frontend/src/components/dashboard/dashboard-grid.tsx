"use client";

import { useCallback, useEffect, useRef } from "react";
import GridLayout from "react-grid-layout";
import type { Layout, Layouts } from "react-grid-layout";
import { DashboardComponent } from "./dashboard-component";
import type {
  DashboardComponent as DashboardComponentType,
  GridConfig,
} from "@/lib/db/types";

import "react-grid-layout/css/styles.css";

const ResponsiveGridLayout = GridLayout.WidthProvider(GridLayout.Responsive);

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
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
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

  // Scroll to bottom when new component is added
  useEffect(() => {
    if (highlightComponentId) {
      // Delay to allow grid layout to fully render
      const timeoutId = setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [highlightComponentId, components]);

  // Convert components to grid layout for all breakpoints
  const generateLayouts = (): Layouts => {
    const baseLayout: Layout[] = components.map((comp) => {
      const gridConfig: GridConfig = JSON.parse(comp.grid_config);
      return {
        i: String(comp.id),
        x: gridConfig.x,
        y: gridConfig.y,
        w: gridConfig.w,
        h: gridConfig.h,
        minW: 2,
        minH: 2,
        static: !editable,
      };
    });

    // Generate responsive layouts
    // For smaller screens, adjust width to fit within column constraints
    const adjustLayout = (layout: Layout[], maxCols: number): Layout[] => {
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
  };

  const layouts = generateLayouts();

  const handleLayoutChange = useCallback(
    (currentLayout: Layout[], allLayouts: Layouts) => {
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
    <div ref={gridRef} className="w-full">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
      >
        {components.map((component) => (
          <div
            key={component.id}
            data-component-id={component.id}
            className={`${editable ? "drag-handle" : ""} ${
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
