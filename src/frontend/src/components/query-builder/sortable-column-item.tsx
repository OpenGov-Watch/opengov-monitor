"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UnifiedColumn, AggregateFunction } from "@/lib/unified-column-utils";
import { getColumnId } from "@/lib/unified-column-utils";

const AGGREGATE_FUNCTIONS: AggregateFunction[] = ["COUNT", "SUM", "AVG", "MIN", "MAX"];

interface SortableColumnItemProps {
  column: UnifiedColumn;
  displayName: string; // Display name for the column (from column-renderer)
  onUpdate: (updates: Partial<UnifiedColumn>) => void;
  onRemove?: () => void;
}

export function SortableColumnItem({
  column,
  displayName,
  onUpdate,
  onRemove,
}: SortableColumnItemProps) {
  const id = getColumnId(column);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (column.type === "regular") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-start gap-2 bg-background p-2 rounded border"
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded mt-1"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <RegularColumnContent
            column={column}
            displayName={displayName}
            onUpdate={onUpdate}
          />
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Expression column
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 bg-muted/20 p-2 rounded border"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded mt-1"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <ExpressionColumnContent
          column={column}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

interface RegularColumnContentProps {
  column: UnifiedColumn & { type: "regular" };
  displayName: string;
  onUpdate: (updates: Partial<UnifiedColumn>) => void;
}

function RegularColumnContent({
  column,
  displayName,
  onUpdate,
}: RegularColumnContentProps) {
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerValue, setHeaderValue] = useState(column.displayName || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingHeader && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingHeader]);

  const handleHeaderClick = () => {
    setHeaderValue(column.displayName || displayName);
    setIsEditingHeader(true);
  };

  const handleHeaderBlur = () => {
    setIsEditingHeader(false);
    // Only set displayName if it differs from default display name
    const newHeader = headerValue.trim();
    if (newHeader && newHeader !== displayName) {
      onUpdate({ displayName: newHeader });
    } else {
      onUpdate({ displayName: undefined });
    }
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleHeaderBlur();
    } else if (e.key === "Escape") {
      setHeaderValue(column.displayName || "");
      setIsEditingHeader(false);
    }
  };

  const handleAggregationChange = (value: string) => {
    onUpdate({
      aggregateFunction: value === "none" ? undefined : (value as AggregateFunction),
    });
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        {isEditingHeader ? (
          <Input
            ref={inputRef}
            value={headerValue}
            onChange={(e) => setHeaderValue(e.target.value)}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            className="h-7 text-sm"
            placeholder="Column header"
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
            onClick={handleHeaderClick}
            title="Click to edit header"
          >
            <div className="text-sm font-medium truncate">
              {column.displayName || displayName}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {column.column}
            </div>
          </div>
        )}
      </div>
      <Select
        value={column.aggregateFunction || "none"}
        onValueChange={handleAggregationChange}
      >
        <SelectTrigger className="w-24 h-8">
          <SelectValue placeholder="Aggregate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Raw</SelectItem>
          {AGGREGATE_FUNCTIONS.map((fn) => (
            <SelectItem key={fn} value={fn}>
              {fn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface ExpressionColumnContentProps {
  column: UnifiedColumn & { type: "expression" };
  onUpdate: (updates: Partial<UnifiedColumn>) => void;
  onRemove?: () => void;
}

function ExpressionColumnContent({
  column,
  onUpdate,
  onRemove,
}: ExpressionColumnContentProps) {
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [isEditingExpression, setIsEditingExpression] = useState(false);
  const [headerValue, setHeaderValue] = useState(column.displayName || column.alias);
  const [expressionValue, setExpressionValue] = useState(column.expression);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const expressionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingHeader && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [isEditingHeader]);

  useEffect(() => {
    if (isEditingExpression && expressionInputRef.current) {
      expressionInputRef.current.focus();
      expressionInputRef.current.select();
    }
  }, [isEditingExpression]);

  // Sync local state when column prop changes
  useEffect(() => {
    setHeaderValue(column.displayName || column.alias);
    setExpressionValue(column.expression);
  }, [column.alias, column.displayName, column.expression]);

  const handleHeaderClick = () => {
    setHeaderValue(column.displayName || column.alias);
    setIsEditingHeader(true);
  };

  const handleHeaderBlur = () => {
    setIsEditingHeader(false);
    const trimmed = headerValue.trim();
    if (!trimmed) {
      // Reset to original if empty
      setHeaderValue(column.displayName || column.alias);
      return;
    }
    // Generate sanitized alias from header (for SQL identifier)
    const sanitizedAlias = trimmed.replace(/[^a-zA-Z0-9_]/g, "_");
    // If header has no special chars, it can be the alias; otherwise set displayName
    if (trimmed === sanitizedAlias) {
      // Simple case: no spaces, use as alias directly
      if (trimmed !== column.alias) {
        onUpdate({ alias: trimmed, displayName: undefined });
      }
    } else {
      // Header has spaces/special chars: set displayName and generate alias
      onUpdate({ displayName: trimmed, alias: sanitizedAlias });
    }
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleHeaderBlur();
    } else if (e.key === "Escape") {
      setHeaderValue(column.displayName || column.alias);
      setIsEditingHeader(false);
    }
  };

  const handleExpressionClick = () => {
    setExpressionValue(column.expression);
    setIsEditingExpression(true);
  };

  const handleExpressionBlur = () => {
    setIsEditingExpression(false);
    const trimmed = expressionValue.trim();
    if (trimmed !== column.expression) {
      onUpdate({ expression: trimmed });
    }
  };

  const handleExpressionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setExpressionValue(column.expression);
      setIsEditingExpression(false);
    }
    // Don't handle Enter for textarea - allow multi-line
  };

  const handleAggregationChange = (value: string) => {
    onUpdate({
      aggregateFunction: value === "none" ? undefined : (value as AggregateFunction),
    });
  };

  // Truncate expression for display
  const displayExpression = column.expression.length > 40
    ? column.expression.slice(0, 40) + "..."
    : column.expression || "(empty expression)";

  // Display header: prefer displayName over alias
  const displayHeader = column.displayName || column.alias || "unnamed";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        {isEditingHeader ? (
          <Input
            ref={headerInputRef}
            value={headerValue}
            onChange={(e) => setHeaderValue(e.target.value)}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            className="h-7 text-sm"
            placeholder="Column header"
          />
        ) : isEditingExpression ? (
          <div className="space-y-1">
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
              onClick={handleHeaderClick}
              title="Click to edit header"
            >
              <div className="text-sm font-medium truncate">
                {displayHeader}
              </div>
            </div>
            <Textarea
              ref={expressionInputRef}
              value={expressionValue}
              onChange={(e) => setExpressionValue(e.target.value)}
              onBlur={handleExpressionBlur}
              onKeyDown={handleExpressionKeyDown}
              placeholder="DOT_latest * 10"
              className="font-mono text-sm min-h-[60px] resize-none"
            />
          </div>
        ) : (
          <div className="px-1 py-0.5">
            <div
              className="cursor-pointer hover:bg-muted/50 rounded text-sm font-medium truncate"
              onClick={handleHeaderClick}
              title="Click to edit header"
            >
              {displayHeader}
            </div>
            <div
              className="cursor-pointer hover:bg-muted/50 rounded text-xs text-muted-foreground truncate"
              onClick={handleExpressionClick}
              title="Click to edit expression"
            >
              {displayExpression}
            </div>
          </div>
        )}
      </div>
      <Select
        value={column.aggregateFunction || "none"}
        onValueChange={handleAggregationChange}
      >
        <SelectTrigger className="w-24 h-8">
          <SelectValue placeholder="Aggregate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Raw</SelectItem>
          {AGGREGATE_FUNCTIONS.map((fn) => (
            <SelectItem key={fn} value={fn}>
              {fn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
