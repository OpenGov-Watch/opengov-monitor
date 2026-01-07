"use client";

import { Suspense } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, FooterCell } from "./data-table";

interface DataTableWrapperProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
  footerCells?: FooterCell[];
  footerLabel?: string;
}

function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
      </div>
      <div className="rounded-md border">
        <div className="h-12 bg-muted/50 border-b" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-b flex items-center gap-4 px-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 bg-muted animate-pulse rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="h-8 w-64 bg-muted animate-pulse rounded-md" />
      </div>
    </div>
  );
}

export function DataTableWrapper<TData, TValue>({
  columns,
  data,
  tableName,
  footerCells,
  footerLabel,
}: DataTableWrapperProps<TData, TValue>) {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <DataTable
        columns={columns}
        data={data}
        tableName={tableName}
        footerCells={footerCells}
        footerLabel={footerLabel}
      />
    </Suspense>
  );
}
