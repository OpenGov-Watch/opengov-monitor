"use client";

import { Row } from "@tanstack/react-table";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { DataTableCard } from "../data-table-card";
import { cn } from "@/lib/utils";

interface CardViewProps<TData> {
  rows: Row<TData>[];
  loading: boolean;
  error: string | null;
}

export function CardView<TData>({
  rows,
  loading,
  error,
}: CardViewProps<TData>) {
  return (
    <div className="flex-1 min-h-0 overflow-auto relative">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Error: {error}</span>
          </div>
        </div>
      )}

      <div className={cn(loading && "opacity-30")}>
        {rows?.length ? (
          rows.map((row) => (
            <DataTableCard key={row.id} row={row} />
          ))
        ) : (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            No results.
          </div>
        )}
      </div>
    </div>
  );
}
