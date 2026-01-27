"use client";

import { LEGEND_STYLES } from "@/lib/export-styles";

export interface ChartLegendItem {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: ChartLegendItem[];
  exportMode?: boolean;
  legendPosition?: "bottom" | "right";
}

/**
 * Unified legend component for pie, bar, and line charts.
 *
 * Uses `exportMode` prop to switch between Tailwind classes (interactive)
 * and inline styles (export). This ensures consistent rendering when
 * captured off-screen by html2canvas.
 */
export function ChartLegend({
  items,
  exportMode = false,
  legendPosition = "bottom",
}: ChartLegendProps) {
  const isVertical = legendPosition === "right";

  // List styles
  const getListStyle = () => {
    if (!exportMode) return undefined;
    return {
      ...LEGEND_STYLES.list.export,
      ...(isVertical
        ? LEGEND_STYLES.listVertical.export
        : LEGEND_STYLES.listHorizontal.export),
    };
  };

  const getListClassName = () => {
    if (exportMode) return undefined;
    return `${LEGEND_STYLES.list.interactive} ${
      isVertical ? LEGEND_STYLES.listVertical.interactive : ""
    }`;
  };

  // Item styles
  const getItemStyle = () => {
    if (!exportMode) return undefined;
    return {
      ...LEGEND_STYLES.item.export,
      ...(isVertical
        ? LEGEND_STYLES.item.exportVertical
        : LEGEND_STYLES.item.exportHorizontal),
    };
  };

  const getItemClassName = () => {
    if (exportMode) return undefined;
    return LEGEND_STYLES.item.interactive;
  };

  // Swatch styles
  const getSwatchStyle = (color: string) => {
    if (!exportMode) {
      return { backgroundColor: color };
    }
    return {
      ...LEGEND_STYLES.swatch.export,
      backgroundColor: color,
    };
  };

  const getSwatchClassName = () => {
    if (exportMode) return undefined;
    return LEGEND_STYLES.swatch.interactive;
  };

  // Label styles
  const getLabelStyle = () => {
    if (!exportMode) return undefined;
    return LEGEND_STYLES.label.export;
  };

  const getLabelClassName = () => {
    if (exportMode) return undefined;
    return LEGEND_STYLES.label.interactive;
  };

  return (
    <ul style={getListStyle()} className={getListClassName()}>
      {items.map((item, index) => (
        <li key={index} style={getItemStyle()} className={getItemClassName()}>
          <span style={getSwatchStyle(item.color)} className={getSwatchClassName()} />
          <span style={getLabelStyle()} className={getLabelClassName()}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
