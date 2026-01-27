/**
 * View state management hook for table configurations.
 *
 * SECURITY CONSIDERATIONS:
 * - This hook stores UI state (filters, sorting, pagination) in localStorage
 * - The stored data is NON-SENSITIVE (table view preferences only)
 * - No authentication tokens, passwords, or PII are stored
 * - localStorage is accessible to JavaScript in the same origin
 * - XSS attacks on this site could read these preferences, but the impact
 *   is limited to revealing user's table view configurations
 * - For sensitive data storage, use httpOnly cookies or secure session storage
 */

import { useState, useCallback, useEffect, useRef, startTransition } from "react";
import {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from "@tanstack/react-table";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import { FilterGroup } from "@/lib/db/types";

export interface ViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  pagination: PaginationState;
  filterGroup?: FilterGroup;  // New: nested filter groups with AND/OR
  groupBy?: string;  // New: group by one column
}

export interface SavedView {
  name: string;
  state: ViewState;
  deletable?: boolean;  // default true if not specified
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
  /**
   * When true, disables URL sync for this hook instance.
   * Use this for dashboard tables where multiple DataTable components
   * would otherwise fight over the same ?view= URL parameter.
   */
  disableUrlSync?: boolean;
}

export function useViewState(tableName: string, options: UseViewStateOptions = {}) {
  const { defaultSorting = [], defaultViews = [], disableUrlSync = false } = options;
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
  const [filterGroup, setFilterGroup] = useState<FilterGroup | undefined>(undefined);
  const [groupBy, setGroupBy] = useState<string | undefined>(undefined);

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

  // Apply a view state to the table
  const applyViewState = useCallback((state: ViewState) => {
    setSorting(state.sorting);
    setColumnFilters(state.columnFilters);
    setColumnVisibility(state.columnVisibility);
    setPagination(state.pagination);
    setFilterGroup(state.filterGroup);
    setGroupBy(state.groupBy);
  }, []);

  // Initialize on mount: check URL first, then localStorage, then defaults
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    // 1. Check URL param first
    const viewParam = searchParams.get("view");
    if (viewParam) {
      const state = decodeViewState(viewParam);
      if (state) {
        applyViewState(state);
        return;
      }
    }

    // 2. Initialize localStorage with defaults if empty
    let views = getSavedViews();
    if (views.length === 0 && defaultViews.length > 0) {
      const storageKey = VIEWS_STORAGE_PREFIX + tableName;
      localStorage.setItem(storageKey, JSON.stringify(defaultViews));
      views = defaultViews;
    }

    // 3. Load first view from localStorage or defaults
    if (views.length > 0) {
      const firstView = views[0];
      applyViewState(firstView.state);
      setCurrentViewName(firstView.name);
    }
  }, [tableName, defaultViews, getSavedViews, applyViewState, searchParams]);

  // Get current state
  const getCurrentState = useCallback(
    (): ViewState => ({
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      filterGroup,
      groupBy,
    }),
    [sorting, columnFilters, columnVisibility, pagination, filterGroup, groupBy]
  );

  // Track last encoded state to prevent unnecessary URL updates
  const lastEncodedState = useRef<string>('');

  // Phase 3: URL sync - debounced URL updates on state changes
  // Optimized: Only update URL if state actually changed (prevents blocking on every render)
  // Note: disableUrlSync prevents URL updates for dashboard tables where multiple
  // DataTable components would otherwise fight over the same ?view= URL parameter
  useEffect(() => {
    if (disableUrlSync) return; // Skip URL sync for dashboard tables
    if (!initialLoadDone.current) return; // Don't sync during initial load

    const timeoutId = setTimeout(() => {
      const currentState = getCurrentState();
      const encoded = encodeViewState(currentState);

      // Only update URL if the encoded state actually changed
      // This prevents unnecessary navigation and reduces main thread blocking
      if (encoded && encoded !== lastEncodedState.current) {
        lastEncodedState.current = encoded;
        // Use location.search instead of searchParams to avoid dependency on searchParams object
        // This prevents re-runs when searchParams reference changes after navigate()
        const params = new URLSearchParams(location.search);
        params.set("view", encoded);
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [sorting, columnFilters, columnVisibility, pagination, filterGroup, groupBy, getCurrentState, navigate, location, disableUrlSync]);

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
        const params = new URLSearchParams(location.search);
        params.set("view", encoded);
        navigate(`${location.pathname}?${params.toString()}`, { replace: true });
      }
    }
  }, [getSavedViews, applyViewState, navigate, location]);

  // Delete a named view
  const deleteView = useCallback((name: string) => {
    const views = getSavedViews();
    const viewToDelete = views.find((v) => v.name === name);

    if (viewToDelete?.deletable === false) {
      return; // Cannot delete non-deletable view
    }

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
      const params = new URLSearchParams(location.search);
      params.set("view", encoded);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [getCurrentState, tableName, navigate, location]);

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

    // Clear URL params immediately (outside of transition to avoid blocking)
    navigate(location.pathname, { replace: true });

    // Wrap state updates in startTransition to prevent blocking the main thread
    // This marks the updates as low-priority, allowing the UI to remain responsive
    startTransition(() => {
      setSorting(defaultSorting);
      setColumnFilters([]);
      setColumnVisibility({});
      setPagination({ pageIndex: 0, pageSize: 100 });
      setFilterGroup(undefined);
      setGroupBy(undefined);
      setCurrentViewName(null);
    });
  }, [tableName, navigate, location.pathname, defaultSorting]);

  // Wrap state setters in startTransition for non-urgent updates
  // This keeps the UI responsive during filter/sort/pagination changes
  const setSortingTransitioned = useCallback((updater: SortingState | ((old: SortingState) => SortingState)) => {
    startTransition(() => {
      setSorting(updater);
    });
  }, []);

  const setColumnFiltersTransitioned = useCallback((updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
    startTransition(() => {
      setColumnFilters(updater);
    });
  }, []);

  const setPaginationTransitioned = useCallback((updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
    startTransition(() => {
      setPagination(updater);
    });
  }, []);

  const setFilterGroupTransitioned = useCallback((updater: FilterGroup | undefined | ((old: FilterGroup | undefined) => FilterGroup | undefined)) => {
    startTransition(() => {
      setFilterGroup(updater);
    });
  }, []);

  return {
    sorting,
    setSorting: setSortingTransitioned,
    columnFilters,
    setColumnFilters: setColumnFiltersTransitioned,
    columnVisibility,
    setColumnVisibility,
    pagination,
    setPagination: setPaginationTransitioned,
    filterGroup,
    setFilterGroup: setFilterGroupTransitioned,
    groupBy,
    setGroupBy,
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
