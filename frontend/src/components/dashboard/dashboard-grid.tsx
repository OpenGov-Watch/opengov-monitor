"use client";

import { useState, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import { DashboardComponent } from "./dashboard-component";
import type {
  DashboardComponent as DashboardComponentType,
  GridConfig,
} from "@/lib/db/types";

import "react-grid-layout/css/styles.css";

interface DashboardGridProps {
  components: DashboardComponentType[];
  editable?: boolean;
  onLayoutChange?: (componentId: number, gridConfig: GridConfig) => void;
  onEditComponent?: (component: DashboardComponentType) => void;
  onDeleteComponent?: (componentId: number) => void;
  width?: number;
}

const COLS = 12;
const ROW_HEIGHT = 80;

export function DashboardGrid({
  components,
  editable = false,
  onLayoutChange,
  onEditComponent,
  onDeleteComponent,
  width = 1200,
}: DashboardGridProps) {
  const [containerWidth, setContainerWidth] = useState(width);

  // Convert components to grid layout
  const layout: Layout[] = components.map((comp) => {
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

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!editable || !onLayoutChange) return;

      // Find changed items and update
      for (const item of newLayout) {
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

  // Measure container width
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

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
    <div ref={containerRef} className="w-full">
      <GridLayout
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        width={containerWidth}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".drag-handle"
        compactType="vertical"
        preventCollision={false}
      >
        {components.map((component) => (
          <div key={component.id} className={editable ? "drag-handle" : ""}>
            <DashboardComponent
              component={component}
              editable={editable}
              onEdit={() => onEditComponent?.(component)}
              onDelete={() => onDeleteComponent?.(component.id)}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
