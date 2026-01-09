import { useState, useCallback, useEffect, useRef } from "react";
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";
import { useSearchParams, useNavigate, useLocation } from "react-router";

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

interface UseViewStateOptions {
  defaultSorting?: SortingState;
}

export function useViewState(tableName: string, options: UseViewStateOptions = {}) {
  const { defaultSorting = [] } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialLoadDone = useRef(false);

  // Initialize state with defaults
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Load from URL only on initial mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [getCurrentState, tableName, searchParams, navigate, location.pathname]);

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
    setSorting(defaultSorting);
    setColumnFilters([]);
    setColumnVisibility({});
    setGlobalFilter("");
    setPagination({ pageIndex: 0, pageSize: 20 });

    // Clear URL params
    navigate(location.pathname, { replace: true });
  }, [tableName, navigate, location.pathname, defaultSorting]);

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
