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
  onRemove?: () => void; // Only for expression columns
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
  const handleAliasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sanitize alias to valid SQL identifier
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "_");
    onUpdate({ alias: sanitized });
  };

  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ expression: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={column.alias}
          onChange={handleAliasChange}
          placeholder="alias_name"
          className="flex-1 font-mono text-sm h-8"
        />
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
      <Textarea
        value={column.expression}
        onChange={handleExpressionChange}
        placeholder="DOT_latest * 10"
        className="font-mono text-sm min-h-[50px] resize-none"
      />
    </div>
  );
}
