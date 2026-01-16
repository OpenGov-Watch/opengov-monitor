import useSWR from "swr";
import type { Category } from "@/lib/db/types";
import { getApiBase } from "@/api/client";

const fetcher = async (url: string): Promise<Category[]> => {
  const response = await fetch(url, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  return response.json();
};

/**
 * SWR hook for fetching categories with automatic deduplication and caching.
 * Multiple components can call this hook - SWR will only make one request.
 */
export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    `${getApiBase()}/categories`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Dedupe requests within 60 seconds
    }
  );

  return {
    categories: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
