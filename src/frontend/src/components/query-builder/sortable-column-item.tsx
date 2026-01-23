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
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState(column.alias || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingAlias && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingAlias]);

  const handleAliasClick = () => {
    setAliasValue(column.alias || displayName);
    setIsEditingAlias(true);
  };

  const handleAliasBlur = () => {
    setIsEditingAlias(false);
    // Only set alias if it differs from display name
    const newAlias = aliasValue.trim();
    if (newAlias && newAlias !== displayName) {
      onUpdate({ alias: newAlias });
    } else {
      onUpdate({ alias: undefined });
    }
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAliasBlur();
    } else if (e.key === "Escape") {
      setAliasValue(column.alias || "");
      setIsEditingAlias(false);
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
        {isEditingAlias ? (
          <Input
            ref={inputRef}
            value={aliasValue}
            onChange={(e) => setAliasValue(e.target.value)}
            onBlur={handleAliasBlur}
            onKeyDown={handleAliasKeyDown}
            className="h-7 text-sm"
            placeholder="Column alias"
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
            onClick={handleAliasClick}
            title="Click to edit alias"
          >
            <div className="text-sm font-medium truncate">
              {column.alias || displayName}
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
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [isEditingExpression, setIsEditingExpression] = useState(false);
  const [aliasValue, setAliasValue] = useState(column.alias);
  const [expressionValue, setExpressionValue] = useState(column.expression);
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const expressionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingAlias && aliasInputRef.current) {
      aliasInputRef.current.focus();
      aliasInputRef.current.select();
    }
  }, [isEditingAlias]);

  useEffect(() => {
    if (isEditingExpression && expressionInputRef.current) {
      expressionInputRef.current.focus();
      expressionInputRef.current.select();
    }
  }, [isEditingExpression]);

  // Sync local state when column prop changes
  useEffect(() => {
    setAliasValue(column.alias);
    setExpressionValue(column.expression);
  }, [column.alias, column.expression]);

  const handleAliasClick = () => {
    setAliasValue(column.alias);
    setIsEditingAlias(true);
  };

  const handleAliasBlur = () => {
    setIsEditingAlias(false);
    // Sanitize alias to valid SQL identifier
    const sanitized = aliasValue.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (sanitized && sanitized !== column.alias) {
      onUpdate({ alias: sanitized });
    } else if (!sanitized) {
      // Reset to original if empty
      setAliasValue(column.alias);
    }
  };

  const handleAliasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAliasBlur();
    } else if (e.key === "Escape") {
      setAliasValue(column.alias);
      setIsEditingAlias(false);
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

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        {isEditingAlias ? (
          <Input
            ref={aliasInputRef}
            value={aliasValue}
            onChange={(e) => setAliasValue(e.target.value)}
            onBlur={handleAliasBlur}
            onKeyDown={handleAliasKeyDown}
            className="h-7 text-sm"
            placeholder="alias_name"
          />
        ) : isEditingExpression ? (
          <div className="space-y-1">
            <div
              className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
              onClick={handleAliasClick}
              title="Click to edit alias"
            >
              <div className="text-sm font-medium truncate">
                {column.alias || "unnamed"}
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
              onClick={handleAliasClick}
              title="Click to edit alias"
            >
              {column.alias || "unnamed"}
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
