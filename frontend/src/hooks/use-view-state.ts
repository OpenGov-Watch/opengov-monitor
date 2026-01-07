"use client";

import { useState, useCallback, useEffect } from "react";
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface ViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  globalFilter: string;
  pagination: PaginationState;
}

const STORAGE_PREFIX = "opengov-view-";

function encodeViewState(state: ViewState): string {
  try {
    return btoa(JSON.stringify(state));
  } catch {
    return "";
  }
}

function decodeViewState(encoded: string): ViewState | null {
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

export function useViewState(tableName: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Load from URL on mount
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam) {
      const state = decodeViewState(viewParam);
      if (state) {
        setSorting(state.sorting);
        setColumnFilters(state.columnFilters);
        setColumnVisibility(state.columnVisibility);
        setGlobalFilter(state.globalFilter);
        setPagination(state.pagination);
      }
    }
  }, [searchParams]);

  // Get current state
  const getCurrentState = useCallback(
    (): ViewState => ({
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    }),
    [sorting, columnFilters, columnVisibility, globalFilter, pagination]
  );

  // Save to localStorage and URL
  const saveViewState = useCallback(() => {
    const state = getCurrentState();
    localStorage.setItem(STORAGE_PREFIX + tableName, JSON.stringify(state));

    // Also update URL
    const encoded = encodeViewState(state);
    if (encoded) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", encoded);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [getCurrentState, tableName, searchParams, router, pathname]);

  // Load from localStorage
  const loadViewState = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + tableName);
    if (stored) {
      try {
        const state = JSON.parse(stored) as ViewState;
        setSorting(state.sorting);
        setColumnFilters(state.columnFilters);
        setColumnVisibility(state.columnVisibility);
        setGlobalFilter(state.globalFilter);
        setPagination(state.pagination);
      } catch (e) {
        console.error("Failed to load view state:", e);
      }
    }
  }, [tableName]);

  // Clear view state
  const clearViewState = useCallback(() => {
    localStorage.removeItem(STORAGE_PREFIX + tableName);
    setSorting([]);
    setColumnFilters([]);
    setColumnVisibility({});
    setGlobalFilter("");
    setPagination({ pageIndex: 0, pageSize: 20 });

    // Clear URL params
    router.replace(pathname, { scroll: false });
  }, [tableName, router, pathname]);

  // Get list of saved views
  const getSavedViews = useCallback((): string[] => {
    const views: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        views.push(key.replace(STORAGE_PREFIX, ""));
      }
    }
    return views;
  }, []);

  return {
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    saveViewState,
    loadViewState,
    clearViewState,
    getSavedViews,
  };
}
