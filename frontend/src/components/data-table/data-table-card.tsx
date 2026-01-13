"use client";

import * as React from "react";
import { Row, flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DataTableCardProps<TData> {
  row: Row<TData>;
}

export function DataTableCard<TData>({ row }: DataTableCardProps<TData>) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const visibleCells = row.getVisibleCells();
  // Show first 3 columns as primary info, rest as expandable details
  const primaryCells = visibleCells.slice(0, 3);
  const detailCells = visibleCells.slice(3);

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        {/* Primary info - always visible */}
        <div className="space-y-2">
          {primaryCells.map((cell) => (
            <div key={cell.id} className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {typeof cell.column.columnDef.header === 'string'
                  ? cell.column.columnDef.header
                  : cell.column.id}
              </span>
              <div className="text-sm mt-1">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </div>
          ))}
        </div>

        {/* Expandable details */}
        {detailCells.length > 0 && (
          <>
            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-2">
                {detailCells.map((cell) => (
                  <div key={cell.id} className="flex flex-col">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {typeof cell.column.columnDef.header === 'string'
                        ? cell.column.columnDef.header
                        : cell.column.id}
                    </span>
                    <div className="text-sm mt-1">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-3 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show details
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
