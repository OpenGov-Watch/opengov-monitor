import type { Category } from "@/lib/db/types";

// Dynamic API base - can be changed at runtime via setApiBase()
let apiBase = "/api";

export function setApiBase(base: string) {
  apiBase = base;
}

export function getApiBase(): string {
  return apiBase;
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies for session auth
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "An error occurred");
  }
  return response.json();
}

export const api = {
  // Read-only endpoints
  referenda: {
    getAll: () => fetchJSON<unknown[]>("/referenda"),
    update: (
      id: number,
      data: {
        category_id?: number | null;
        notes?: string | null;
        hide_in_spends?: number | null;
      }
    ) =>
      fetchJSON(`/referenda/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    import: (
      items: Array<{
        id: number;
        category_id?: number | null;  // Keep for backward compatibility
        category?: string | null;      // New: category name
        subcategory?: string | null;   // New: subcategory name
        notes?: string | null;
        hide_in_spends?: number | null;
      }>
    ) =>
      fetchJSON<{ success: boolean; count: number }>("/referenda/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
  },
  treasury: {
    getAll: () => fetchJSON<unknown[]>("/treasury"),
  },
  childBounties: {
    getAll: () => fetchJSON<unknown[]>("/child-bounties"),
    update: (
      identifier: string,
      data: {
        category_id?: number | null;
        notes?: string | null;
        hide_in_spends?: number | null;
      }
    ) =>
      fetchJSON(`/child-bounties/${encodeURIComponent(identifier)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    import: (
      items: Array<{
        identifier: string;
        category_id?: number | null;  // Keep for backward compatibility
        category?: string | null;      // New: category name
        subcategory?: string | null;   // New: subcategory name
        notes?: string | null;
        hide_in_spends?: number | null;
      }>
    ) =>
      fetchJSON<{ success: boolean; count: number }>("/child-bounties/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
  },
  fellowship: {
    getAll: () => fetchJSON<unknown[]>("/fellowship"),
  },
  salary: {
    getCycles: () => fetchJSON<unknown[]>("/fellowship-salary/cycles"),
    getClaimants: () => fetchJSON<unknown[]>("/fellowship-salary/claimants"),
  },
  claims: {
    getOutstanding: () => fetchJSON<unknown[]>("/claims/outstanding"),
    getExpired: () => fetchJSON<unknown[]>("/claims/expired"),
  },
  spending: {
    getAll: () => fetchJSON<unknown[]>("/spending"),
  },
  stats: {
    get: () => fetchJSON<Record<string, number | null>>("/stats"),
  },

  // CRUD endpoints
  categories: {
    getAll: () => fetchJSON<Category[]>("/categories"),
    create: (category: string, subcategory: string) =>
      fetchJSON<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ category, subcategory }),
      }),
    update: (id: number, category: string, subcategory: string) =>
      fetchJSON(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ category, subcategory }),
      }),
    delete: (id: number) =>
      fetchJSON(`/categories/${id}`, { method: "DELETE" }),
    // Find or create a category by string names
    lookup: (category: string, subcategory: string) =>
      fetchJSON<Category>("/categories/lookup", {
        method: "POST",
        body: JSON.stringify({ category, subcategory }),
      }),
  },
  bounties: {
    getAll: () => fetchJSON<unknown[]>("/bounties"),
    getById: (id: number) => fetchJSON<unknown>(`/bounties/${id}`),
    create: (data: unknown) =>
      fetchJSON("/bounties", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchJSON(`/bounties/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateCategory: (id: number, category_id: number | null) =>
      fetchJSON(`/bounties/${id}/category`, {
        method: "PATCH",
        body: JSON.stringify({ category_id }),
      }),
    delete: (id: number) =>
      fetchJSON(`/bounties/${id}`, { method: "DELETE" }),
  },
  subtreasury: {
    getAll: () => fetchJSON<unknown[]>("/subtreasury"),
    getById: (id: number) => fetchJSON<unknown>(`/subtreasury/${id}`),
    create: (data: unknown) =>
      fetchJSON("/subtreasury", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: unknown) =>
      fetchJSON(`/subtreasury/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchJSON(`/subtreasury/${id}`, { method: "DELETE" }),
  },

  treasuryNetflows: {
    import: (
      items: Array<{
        month: string;
        asset_name: string;
        flow_type: string;
        amount_usd: number;
        amount_dot_equivalent: number;
      }>
    ) =>
      fetchJSON<{ success: boolean; count: number }>("/treasury-netflows/import", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
  },

  // Dashboards
  dashboards: {
    getAll: () => fetchJSON<unknown[]>("/dashboards"),
    getById: (id: number) => fetchJSON<unknown>(`/dashboards?id=${id}`),
    create: (name: string, description: string | null) =>
      fetchJSON("/dashboards", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    update: (id: number, name: string, description: string | null) =>
      fetchJSON("/dashboards", {
        method: "PUT",
        body: JSON.stringify({ id, name, description }),
      }),
    delete: (id: number) =>
      fetchJSON(`/dashboards?id=${id}`, { method: "DELETE" }),
  },
  dashboardComponents: {
    getByDashboardId: (dashboardId: number) =>
      fetchJSON<unknown[]>(`/dashboards/components?dashboard_id=${dashboardId}`),
    getById: (id: number) => fetchJSON<unknown>(`/dashboards/components?id=${id}`),
    create: (data: unknown) =>
      fetchJSON("/dashboards/components", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (data: unknown) =>
      fetchJSON("/dashboards/components", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    updateGrid: (id: number, gridConfig: unknown) =>
      fetchJSON("/dashboards/components", {
        method: "PUT",
        body: JSON.stringify({ id, grid_config: gridConfig, grid_only: true }),
      }),
    delete: (id: number) =>
      fetchJSON(`/dashboards/components?id=${id}`, { method: "DELETE" }),
  },

  // Query builder
  query: {
    getSchema: () => fetchJSON<unknown[]>("/query/schema"),
    execute: (config: unknown) =>
      fetchJSON<{ data: unknown[]; rowCount: number; sql: string }>("/query/execute", {
        method: "POST",
        body: JSON.stringify(config),
      }),
  },

  // Sync settings
  sync: {
    getDefaultReferenda: () => fetchJSON<{ content: string }>("/sync/defaults/referenda"),
    getDefaultChildBounties: () => fetchJSON<{ content: string }>("/sync/defaults/child-bounties"),
    getDefaultTreasuryNetflows: () => fetchJSON<{ content: string }>("/sync/defaults/treasury-netflows"),
  },
};
