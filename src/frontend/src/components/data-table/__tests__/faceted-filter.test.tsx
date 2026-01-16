import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Column } from "@tanstack/react-table";
import { DataTableFacetedFilter } from "../faceted-filter";
import { FilterGroup } from "@/lib/db/types";

// Mock scrollIntoView for test environment
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock column for testing
const createMockColumn = (
  filterValue?: string[],
  facets?: Map<any, number>
): Partial<Column<any, any>> => ({
  getFilterValue: vi.fn(() => filterValue),
  setFilterValue: vi.fn(),
  getFacetedUniqueValues: vi.fn(() => facets || new Map([
    ["Active", 10],
    ["Pending", 5],
    ["Completed", 3],
  ])),
  getCanSort: vi.fn(() => true),
});

describe("DataTableFacetedFilter - Unified State", () => {
  describe("FilterGroup Integration", () => {
    it("renders with filterGroup prop and reads applied values correctly", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active", "Pending"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="status"
        />
      );

      // Should display count of applied filters
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("writes selections to filterGroup via onFilterGroupChange callback", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="status"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      // Select "Active"
      await waitFor(() => {
        const activeOption = screen.getByText("Active");
        fireEvent.click(activeOption);
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should call onFilterGroupChange with new condition
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      });
    });

    it("merges with existing filterGroup conditions without overwriting", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "amount", operator: ">", value: 1000 },
          { column: "track", operator: "IN", value: ["root"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="status"
        />
      );

      // Open popover and select "Active"
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const activeOption = screen.getByText("Active");
        fireEvent.click(activeOption);
      });

      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should preserve existing conditions
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "amount", operator: ">", value: 1000 },
          { column: "track", operator: "IN", value: ["root"] },
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      });
    });

    it("removes column's IN conditions when clearing selection", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active", "Pending"] },
          { column: "amount", operator: ">", value: 1000 },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="status"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      // Clear selection
      await waitFor(() => {
        const clearButton = screen.getByText(/clear selection/i);
        fireEvent.click(clearButton);
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should remove status condition but keep others
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "amount", operator: ">", value: 1000 },
        ],
      });
    });

    it("replaces existing IN condition for same column", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="status"
        />
      );

      // Open popover and change selection
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const pendingOption = screen.getByText("Pending");
        fireEvent.click(pendingOption);
      });

      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should replace, not append
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active", "Pending"] },
        ],
      });
    });
  });

  describe("Backward Compatibility", () => {
    it("falls back to column.getFilterValue() when filterGroup not provided", () => {
      const column = createMockColumn(["Active", "Pending"]) as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
        />
      );

      // Should display count based on column filter value
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(column.getFilterValue).toHaveBeenCalled();
    });

    it("falls back to column.setFilterValue() when onFilterGroupChange not provided", async () => {
      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
        />
      );

      // Open popover and select "Active"
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const activeOption = screen.getByText("Active");
        fireEvent.click(activeOption);
      });

      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should call legacy setFilterValue
      expect(column.setFilterValue).toHaveBeenCalledWith(["Active"]);
    });
  });

  describe("Transaction Pattern", () => {
    it("maintains apply/cancel transaction pattern (pending state isolation)", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="status"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      // Make changes
      await waitFor(() => {
        const pendingOption = screen.getByText("Pending");
        fireEvent.click(pendingOption);
      });

      // Cancel instead of apply
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Should NOT call onFilterGroupChange
      expect(onFilterGroupChange).not.toHaveBeenCalled();

      // Badge should still show original count
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("syncs pending values when popover opens", async () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      const { rerender } = render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="status"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /status/i });
      fireEvent.click(trigger);

      // Active should be checked
      await waitFor(() => {
        const activeItem = screen.getByText("Active").closest("div");
        expect(activeItem?.querySelector("svg")).toBeInTheDocument();
      });

      // Close popover
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Change filterGroup externally (simulating advanced filter change)
      const newFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Pending"] },
        ],
      };

      rerender(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={newFilterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="status"
        />
      );

      // Open popover again
      fireEvent.click(trigger);

      // Pending should now be checked (synced from filterGroup)
      await waitFor(() => {
        const pendingItem = screen.getByText("Pending").closest("div");
        expect(pendingItem?.querySelector("svg")).toBeInTheDocument();
      });
    });
  });

  describe("Memoization", () => {
    it("uses memoization for appliedValues to prevent unnecessary re-renders", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      const { rerender } = render(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="status"
        />
      );

      // Initial render should show "1"
      expect(screen.getByText("1")).toBeInTheDocument();

      // Re-render with same filterGroup (different object reference)
      const sameFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      rerender(
        <DataTableFacetedFilter
          column={column}
          title="Status"
          filterGroup={sameFilterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="status"
        />
      );

      // Should still show "1" without errors (memoization working)
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });
});
