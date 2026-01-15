import { useState, useCallback, useEffect, useRef } from "react";
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";
import { useSearchParams, useNavigate, useLocation } from "react-router";

export interface ViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  pagination: PaginationState;
}

export interface SavedView {
  name: string;
  state: ViewState;
  isDefault?: boolean;
}

const STORAGE_PREFIX = "opengov-view-";
const VIEWS_STORAGE_PREFIX = "opengov-views-";

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
  defaultViews?: SavedView[];
}

export function useViewState(tableName: string, options: UseViewStateOptions = {}) {
  const { defaultSorting = [], defaultViews = [] } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialLoadDone = useRef(false);

  // Initialize state with defaults
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });

  // Current active view name
  const [currentViewName, setCurrentViewName] = useState<string | null>(null);

  // Get all saved views for this table
  const getSavedViews = useCallback((): SavedView[] => {
    const storageKey = VIEWS_STORAGE_PREFIX + tableName;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        return JSON.parse(stored) as SavedView[];
      } catch {
        return [];
      }
    }
    return [];
  }, [tableName]);

  // Initialize with default views if no saved views exist
  useEffect(() => {
    const existingViews = getSavedViews();
    if (existingViews.length === 0 && defaultViews.length > 0) {
      const storageKey = VIEWS_STORAGE_PREFIX + tableName;
      localStorage.setItem(storageKey, JSON.stringify(defaultViews));
    }
  }, [tableName, defaultViews, getSavedViews]);

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
        setPagination(state.pagination);
        return;
      }
    }

    // If no URL view, try to load the first default or saved view
    const views = getSavedViews();
    if (views.length === 0 && defaultViews.length > 0) {
      // Use first default view
      const firstView = defaultViews[0];
      applyViewState(firstView.state);
      setCurrentViewName(firstView.name);
    } else if (views.length > 0) {
      // Use first saved view
      const firstView = views[0];
      applyViewState(firstView.state);
      setCurrentViewName(firstView.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply a view state to the table
  const applyViewState = useCallback((state: ViewState) => {
    setSorting(state.sorting);
    setColumnFilters(state.columnFilters);
    setColumnVisibility(state.columnVisibility);
    setPagination(state.pagination);
  }, []);

  // Get current state
  const getCurrentState = useCallback(
    (): ViewState => ({
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    }),
    [sorting, columnFilters, columnVisibility, pagination]
  );

  // Save a named view
  const saveView = useCallback((name: string, overwrite: boolean = false): boolean => {
    const views = getSavedViews();
    const existingIndex = views.findIndex((v) => v.name === name);

    if (existingIndex >= 0 && !overwrite) {
      // View exists and we're not overwriting
      return false;
    }

    const newView: SavedView = {
      name,
      state: getCurrentState(),
    };

    let updatedViews: SavedView[];
    if (existingIndex >= 0) {
      // Overwrite existing view
      updatedViews = [...views];
      updatedViews[existingIndex] = newView;
    } else {
      // Add new view
      updatedViews = [...views, newView];
    }

    const storageKey = VIEWS_STORAGE_PREFIX + tableName;
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));
    setCurrentViewName(name);
    return true;
  }, [tableName, getCurrentState, getSavedViews]);

  // Load a named view
  const loadView = useCallback((name: string) => {
    const views = getSavedViews();
    const view = views.find((v) => v.name === name);
    if (view) {
      applyViewState(view.state);
      setCurrentViewName(name);

      // Update URL
      const encoded = encodeViewState(view.state);
      if (encoded) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", encoded);
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    }
  }, [getSavedViews, applyViewState, searchParams, navigate, location.pathname]);

  // Delete a named view
  const deleteView = useCallback((name: string) => {
    const views = getSavedViews();
    const updatedViews = views.filter((v) => v.name !== name);
    const storageKey = VIEWS_STORAGE_PREFIX + tableName;
    localStorage.setItem(storageKey, JSON.stringify(updatedViews));

    // If we deleted the current view, switch to first available or clear
    if (currentViewName === name) {
      if (updatedViews.length > 0) {
        loadView(updatedViews[0].name);
      } else {
        setCurrentViewName(null);
        clearViewState();
      }
    }
  }, [tableName, getSavedViews, currentViewName, loadView]);

  // Legacy save/load for backwards compatibility (deprecated)
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

  // Legacy load (deprecated)
  const loadViewState = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + tableName);
    if (stored) {
      try {
        const state = JSON.parse(stored) as ViewState;
        applyViewState(state);
      } catch (e) {
        console.error("Failed to load view state:", e);
      }
    }
  }, [tableName, applyViewState]);

  // Clear view state
  const clearViewState = useCallback(() => {
    localStorage.removeItem(STORAGE_PREFIX + tableName);
    setSorting(defaultSorting);
    setColumnFilters([]);
    setColumnVisibility({});
    setPagination({ pageIndex: 0, pageSize: 100 });
    setCurrentViewName(null);

    // Clear URL params
    navigate(location.pathname, { replace: true });
  }, [tableName, navigate, location.pathname, defaultSorting]);

  return {
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    pagination,
    setPagination,
    // New multi-view API
    currentViewName,
    getSavedViews,
    saveView,
    loadView,
    deleteView,
    // Legacy API (deprecated but kept for backwards compatibility)
    saveViewState,
    loadViewState,
    clearViewState,
  };
}
