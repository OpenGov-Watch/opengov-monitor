"use client";

import { memo } from "react";
import {
  getColumnConfig,
  formatValue,
} from "@/lib/column-renderer";

interface MetricDisplayProps {
  value: number | string | null;
  label?: string;
  prefix?: string;
  suffix?: string;
  tableName?: string;
  valueColumn?: string;
  columnMapping?: Record<string, string>;
}

export const MetricDisplay = memo(
  function MetricDisplay({
    value,
    label,
    prefix,
    suffix,
    tableName = "",
    valueColumn = "",
    columnMapping,
  }: MetricDisplayProps) {
    // Format the value using column config if available
    let displayValue: string;
    if (value === null || value === undefined) {
      displayValue = "-";
    } else if (typeof value === "number") {
      const sourceColumn = columnMapping?.[valueColumn] ?? valueColumn;
      const config = getColumnConfig(tableName, sourceColumn);
      displayValue = formatValue(value, config);
    } else {
      displayValue = String(value);
    }

    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <div className="text-center @container w-full">
          <p className="font-bold text-muted-foreground leading-none whitespace-nowrap text-[clamp(1.3rem,10cqw,4rem)]">
            {prefix && <span>{prefix}</span>}
            <span>{displayValue}</span>
            {suffix && <span>{suffix}</span>}
          </p>
          {label && (
            <p className="mt-2 text-muted-foreground text-[clamp(0.65rem,2.5cqw,1rem)]">
              {label}
            </p>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.label === nextProps.label &&
      prevProps.prefix === nextProps.prefix &&
      prevProps.suffix === nextProps.suffix &&
      prevProps.tableName === nextProps.tableName &&
      prevProps.valueColumn === nextProps.valueColumn &&
      prevProps.columnMapping === nextProps.columnMapping
    );
  }
);
