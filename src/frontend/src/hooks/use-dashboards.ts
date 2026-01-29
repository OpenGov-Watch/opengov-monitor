import useSWR from "swr";
import type { Dashboard } from "@/lib/db/types";
import { getApiBase } from "@/api/client";

const fetcher = async (url: string): Promise<Dashboard[]> => {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch dashboards");
  }
  return response.json();
};

/**
 * SWR hook for fetching dashboards with automatic deduplication and caching.
 * Multiple components can call this hook - SWR will only make one request.
 */
export function useDashboards() {
  const { data, error, isLoading, mutate } = useSWR<Dashboard[]>(
    `${getApiBase()}/dashboards`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Dedupe requests within 60 seconds
    }
  );

  return {
    dashboards: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
