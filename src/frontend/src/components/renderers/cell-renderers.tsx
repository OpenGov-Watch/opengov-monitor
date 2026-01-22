"use client";

import React from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { Badge } from "@/components/ui/badge";
import { type ColumnRenderConfig } from "@/lib/column-renderer";

// ============================================================================
// Currency Cell
// ============================================================================

interface CurrencyCellProps {
  value: number | null;
  currency?: string;
  decimals?: number;
}

export const CurrencyCell = React.memo(function CurrencyCell({ value, currency = "DOT", decimals = 0 }: CurrencyCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return (
    <div className="text-right font-mono">
      {formatted} {currency}
    </div>
  );
});

// ============================================================================
// Number Cell
// ============================================================================

interface NumberCellProps {
  value: number | null;
  decimals?: number;
  color?: "green" | "red";
}

export const NumberCell = React.memo(function NumberCell({ value, decimals = 0, color }: NumberCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

  let colorClass = "";
  if (color === "green") colorClass = "text-green-600";
  if (color === "red") colorClass = "text-red-600";

  return <div className={`text-right ${colorClass}`}>{formatted}</div>;
});

// ============================================================================
// Date Cell
// ============================================================================

interface DateCellProps {
  value: string | null;
  format?: "date" | "datetime";
}

export const DateCell = React.memo(function DateCell({ value }: DateCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;

  return <span>{formatted}</span>;
});

// ============================================================================
// Badge Cell
// ============================================================================

interface BadgeCellProps {
  value: string | null;
  variants?: Record<string, string>;
}

export const BadgeCell = React.memo(function BadgeCell({ value, variants }: BadgeCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  const variant = variants?.[value] || variants?.["default"] || "outline";

  return (
    <Badge
      variant={
        variant as
          | "default"
          | "secondary"
          | "destructive"
          | "outline"
          | "success"
          | "warning"
      }
    >
      {value}
    </Badge>
  );
});

// ============================================================================
// Link Cell
// ============================================================================

interface LinkCellProps {
  value: string | number | null;
  urlTemplate?: string;
  urlField?: string;
  row?: Record<string, unknown>;
  showIcon?: boolean;
}

export const LinkCell = React.memo(function LinkCell({
  value,
  urlTemplate,
  urlField,
  row,
  showIcon = false,
}: LinkCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Get URL from field or template
  let url: string | null = null;
  if (urlField && row) {
    url = row[urlField] ? String(row[urlField]) : null;
  } else if (urlTemplate) {
    url = urlTemplate.replace("{value}", String(value));
  }

  if (!url) {
    return <span>{String(value)}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline inline-flex items-center gap-1"
    >
      {typeof value === "number" ? `#${value}` : value}
      {showIcon && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
    </a>
  );
});

// ============================================================================
// Address Cell
// ============================================================================

interface AddressCellProps {
  value: string | null;
  truncate?: boolean;
}

export const AddressCell = React.memo(function AddressCell({ value, truncate = true }: AddressCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  const displayValue =
    truncate && value.length > 16
      ? `${value.slice(0, 8)}...${value.slice(-6)}`
      : value;

  return (
    <span className="font-mono text-xs" title={value}>
      {displayValue}
    </span>
  );
});

// ============================================================================
// Text Cell
// ============================================================================

interface TextCellProps {
  value: string | number | null;
  truncate?: boolean;
  maxWidth?: number;
}

export const TextCell = React.memo(function TextCell({ value, truncate = false, maxWidth = 350 }: TextCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const strValue = String(value);

  if (truncate) {
    return (
      <span
        className="truncate block"
        style={{ maxWidth: `${maxWidth}px` }}
        title={strValue}
      >
        {strValue}
      </span>
    );
  }

  return <span>{strValue}</span>;
});

// ============================================================================
// Dynamic Cell (Main Dispatcher)
// ============================================================================

interface DynamicCellProps {
  value: unknown;
  config: ColumnRenderConfig;
  row?: Record<string, unknown>;
}

export const DynamicCell = React.memo(function DynamicCell({ value, config, row }: DynamicCellProps) {
  switch (config.type) {
    case "currency":
      return (
        <CurrencyCell
          value={value as number | null}
          currency={config.currency}
          decimals={config.decimals}
        />
      );

    case "numeric":
      return (
        <NumberCell
          value={value as number | null}
          decimals={config.decimals}
          color={config.color}
        />
      );

    case "date":
      return (
        <DateCell value={value as string | null} format={config.format} />
      );

    case "categorical":
      return (
        <BadgeCell value={value as string | null} variants={config.variants} />
      );

    case "link":
      return (
        <LinkCell
          value={value as string | number | null}
          urlTemplate={config.urlTemplate}
          urlField={config.urlField}
          row={row}
          showIcon={!!config.urlField}
        />
      );

    case "address":
      return (
        <AddressCell value={value as string | null} truncate={config.truncate} />
      );

    case "text":
    default:
      return <TextCell value={value as string | number | null} />;
  }
});
