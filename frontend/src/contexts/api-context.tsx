/**
 * API configuration context for dynamic API server selection.
 *
 * Provides:
 * - Runtime config loading from /config.json
 * - URL parameter parsing (?api=local, ?api=production, ?api=3002, ?api=https://...)
 * - localStorage persistence for API selection
 * - Module-level getApiBase() for non-React code
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { setApiBase } from "@/api/client";

interface AppConfig {
  apiPresets: Record<string, string>;
  defaultPreset: string;
}

interface ApiContextValue {
  apiBase: string;
  presets: Record<string, string>;
  currentPreset: string | null;
  isLoading: boolean;
  setApi: (value: string) => void;
}

const ApiContext = createContext<ApiContextValue | null>(null);

const STORAGE_KEY = "opengov-api-selection";
const DEFAULT_API_BASE = "/api";

/**
 * Get URL search param value directly from window.location
 */
function getUrlParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Update URL search param using history API (doesn't trigger navigation)
 */
function setUrlParam(name: string, value: string | null): void {
  const params = new URLSearchParams(window.location.search);
  if (value) {
    params.set(name, value);
  } else {
    params.delete(name);
  }
  const newSearch = params.toString();
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

/**
 * Resolve an API URL from various input formats:
 * - Preset name (e.g., "local", "production") -> looks up in presets
 * - Port number (e.g., "3002" or ":3002") -> http://localhost:{port}/api
 * - Full URL (e.g., "https://example.com/api") -> used as-is
 */
function resolveApiUrl(
  value: string,
  presets: Record<string, string>
): { url: string; preset: string | null } {
  // 1. Check if it's a preset name
  if (presets[value]) {
    return { url: presets[value], preset: value };
  }

  // 2. Check if it's a port number (e.g., "3002" or ":3002")
  const portMatch = value.match(/^:?(\d{4,5})$/);
  if (portMatch) {
    return { url: `http://localhost:${portMatch[1]}/api`, preset: null };
  }

  // 3. Assume it's a full URL
  return { url: value, preset: null };
}

interface ApiProviderProps {
  children: ReactNode;
}

export function ApiProvider({ children }: ApiProviderProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [apiBase, setApiBaseState] = useState(DEFAULT_API_BASE);
  const [currentPreset, setCurrentPreset] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load config.json on mount
  useEffect(() => {
    fetch("/config.json")
      .then((res) => {
        if (!res.ok) throw new Error("Config not found");
        return res.json();
      })
      .then((data: AppConfig) => {
        setConfig(data);
      })
      .catch((err) => {
        console.warn("Failed to load config.json, using defaults:", err);
        // Use minimal default config
        setConfig({
          apiPresets: { local: "/api" },
          defaultPreset: "local",
        });
      });
  }, []);

  // Resolve API URL once config is loaded
  useEffect(() => {
    if (!config) return;

    const urlParam = getUrlParam("api");
    const storedValue = localStorage.getItem(STORAGE_KEY);

    // Priority: URL param > localStorage > config default
    const value = urlParam || storedValue || config.defaultPreset;
    const { url, preset } = resolveApiUrl(value, config.apiPresets);

    setApiBaseState(url);
    setCurrentPreset(preset);
    setApiBase(url); // Update module-level for non-React code

    // Persist to localStorage if we resolved a value
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    }

    setIsLoading(false);
  }, [config]);

  // Function to change API selection
  const setApi = useCallback(
    (value: string) => {
      if (!config) return;

      const { url, preset } = resolveApiUrl(value, config.apiPresets);

      setApiBaseState(url);
      setCurrentPreset(preset);
      setApiBase(url);
      localStorage.setItem(STORAGE_KEY, value);

      // Update URL param
      if (value && value !== config.defaultPreset) {
        setUrlParam("api", value);
      } else {
        setUrlParam("api", null);
      }
    },
    [config]
  );

  const contextValue: ApiContextValue = {
    apiBase,
    presets: config?.apiPresets || {},
    currentPreset,
    isLoading,
    setApi,
  };

  // Don't render children until API base is determined
  // This ensures AuthProvider doesn't make requests before we know which API to use
  if (isLoading) {
    return null;
  }

  return (
    <ApiContext.Provider value={contextValue}>{children}</ApiContext.Provider>
  );
}

export function useApi(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("useApi must be used within an ApiProvider");
  }
  return context;
}
