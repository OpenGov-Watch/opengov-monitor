/**
 * API Client Tests
 *
 * Tests for the centralized API client that handles
 * all communication with the backend REST API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../api/client";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse<T>(data: T, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(data),
  });
}

function mockErrorResponse(errorMessage: string, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: "Bad Request",
    json: () => Promise.resolve({ error: errorMessage }),
  });
}

function mockNetworkError() {
  return Promise.reject(new Error("Network error"));
}

describe("API Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchJSON base functionality", () => {
    it("makes GET request with correct URL", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));

      await api.referenda.getAll();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/referenda",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("makes POST request with JSON body", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ id: 1 }));

      await api.categories.create("Test", "Sub");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ category: "Test", subcategory: "Sub" }),
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("makes PUT request with JSON body", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.categories.update(1, "Updated", "NewSub");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ category: "Updated", subcategory: "NewSub" }),
        })
      );
    });

    it("makes DELETE request", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.categories.delete(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("makes PATCH request with JSON body", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.referenda.update(123, { category_id: 5 });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/referenda/123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ category_id: 5 }),
        })
      );
    });

    it("parses JSON response", async () => {
      const responseData = [{ id: 1, name: "Test" }];
      mockFetch.mockImplementationOnce(() => mockResponse(responseData));

      const result = await api.referenda.getAll();

      expect(result).toEqual(responseData);
    });
  });

  describe("error handling", () => {
    it("throws on non-OK status with error message from response", async () => {
      mockFetch.mockImplementationOnce(() =>
        mockErrorResponse("category is required")
      );

      await expect(api.categories.create("", "Sub")).rejects.toThrow(
        "category is required"
      );
    });

    it("falls back to statusText when no error field", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({}),
        })
      );

      await expect(api.referenda.getAll()).rejects.toThrow("An error occurred");
    });

    it("handles JSON parse error in error response", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.reject(new Error("Invalid JSON")),
        })
      );

      await expect(api.referenda.getAll()).rejects.toThrow(
        "Internal Server Error"
      );
    });

    it("propagates network errors", async () => {
      mockFetch.mockImplementationOnce(() => mockNetworkError());

      await expect(api.referenda.getAll()).rejects.toThrow("Network error");
    });
  });

  describe("referenda namespace", () => {
    it("getAll fetches from /referenda", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));

      await api.referenda.getAll();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/referenda",
        expect.any(Object)
      );
    });

    it("update sends PATCH to /referenda/:id", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.referenda.update(42, { category_id: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/referenda/42",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("childBounties namespace", () => {
    it("encodes identifier in URL", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.childBounties.update("1_23", { category_id: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/child-bounties/1_23",
        expect.any(Object)
      );
    });

    it("handles special characters in identifier", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.childBounties.update("test/special", { category_id: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("test/special")),
        expect.any(Object)
      );
    });
  });

  describe("categories namespace", () => {
    it("lookup sends POST with category and subcategory", async () => {
      mockFetch.mockImplementationOnce(() =>
        mockResponse({ id: 1, category: "Development", subcategory: "Core" })
      );

      const result = await api.categories.lookup("Development", "Core");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/lookup",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ category: "Development", subcategory: "Core" }),
        })
      );
      expect(result.id).toBe(1);
    });

    it("lookup handles empty subcategory", async () => {
      mockFetch.mockImplementationOnce(() =>
        mockResponse({ id: 2, category: "Marketing", subcategory: "" })
      );

      await api.categories.lookup("Marketing", "");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/categories/lookup",
        expect.objectContaining({
          body: JSON.stringify({ category: "Marketing", subcategory: "" }),
        })
      );
    });
  });

  describe("bounties namespace", () => {
    it("getAll fetches all bounties", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));

      await api.bounties.getAll();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties",
        expect.any(Object)
      );
    });

    it("getById fetches single bounty", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ id: 1 }));

      await api.bounties.getById(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties/1",
        expect.any(Object)
      );
    });

    it("create sends POST with data", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.bounties.create({ id: 1, name: "Test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: 1, name: "Test" }),
        })
      );
    });

    it("update sends PUT with data", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.bounties.update(1, { name: "Updated" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ name: "Updated" }),
        })
      );
    });

    it("updateCategory sends PATCH", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.bounties.updateCategory(1, 5);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties/1/category",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    it("delete sends DELETE", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.bounties.delete(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/bounties/1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("subtreasury namespace", () => {
    it("create sends POST", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ id: 1 }));

      await api.subtreasury.create({ title: "Test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subtreasury",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Test" }),
        })
      );
    });

    it("update sends PUT", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.subtreasury.update(1, { title: "Updated" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/subtreasury/1",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("dashboards namespace", () => {
    it("getById uses query param", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ id: 1 }));

      await api.dashboards.getById(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards?id=1",
        expect.any(Object)
      );
    });

    it("create sends POST with name and description", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ id: 1 }));

      await api.dashboards.create("Dashboard", "Description");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Dashboard", description: "Description" }),
        })
      );
    });

    it("update sends PUT with id, name, description", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.dashboards.update(1, "Updated", "New desc");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ id: 1, name: "Updated", description: "New desc" }),
        })
      );
    });

    it("delete uses query param", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.dashboards.delete(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards?id=1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("dashboardComponents namespace", () => {
    it("getByDashboardId uses query param", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));

      await api.dashboardComponents.getByDashboardId(1);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards/components?dashboard_id=1",
        expect.any(Object)
      );
    });

    it("updateGrid sends PUT with grid_only flag", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({ success: true }));

      await api.dashboardComponents.updateGrid(1, { x: 0, y: 0, w: 4, h: 2 });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/dashboards/components",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            id: 1,
            grid_config: { x: 0, y: 0, w: 4, h: 2 },
            grid_only: true,
          }),
        })
      );
    });
  });

  describe("query namespace", () => {
    it("getSchema fetches from /query/schema", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));

      await api.query.getSchema();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/query/schema",
        expect.any(Object)
      );
    });

    it("execute sends POST with QueryConfig", async () => {
      const queryConfig = {
        sourceTable: "Referenda",
        columns: [{ name: "id" }],
        filters: [],
        orderBy: [],
        limit: 100,
      };
      mockFetch.mockImplementationOnce(() =>
        mockResponse({ data: [], rowCount: 0, sql: "SELECT..." })
      );

      await api.query.execute(queryConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/query/execute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(queryConfig),
        })
      );
    });
  });

  describe("other namespaces", () => {
    it("treasury.getAll fetches treasury data", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));
      await api.treasury.getAll();
      expect(mockFetch).toHaveBeenCalledWith("/api/treasury", expect.any(Object));
    });

    it("fellowship.getAll fetches fellowship data", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));
      await api.fellowship.getAll();
      expect(mockFetch).toHaveBeenCalledWith("/api/fellowship", expect.any(Object));
    });

    it("salary.getCycles fetches salary cycles", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));
      await api.salary.getCycles();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fellowship-salary/cycles",
        expect.any(Object)
      );
    });

    it("claims.getOutstanding fetches outstanding claims", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));
      await api.claims.getOutstanding();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/claims/outstanding",
        expect.any(Object)
      );
    });

    it("spending.getAll fetches spending data", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse([]));
      await api.spending.getAll();
      expect(mockFetch).toHaveBeenCalledWith("/api/spending", expect.any(Object));
    });

    it("stats.get fetches stats", async () => {
      mockFetch.mockImplementationOnce(() => mockResponse({}));
      await api.stats.get();
      expect(mockFetch).toHaveBeenCalledWith("/api/stats", expect.any(Object));
    });
  });
});
