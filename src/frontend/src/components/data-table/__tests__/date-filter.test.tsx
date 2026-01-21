import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Column } from "@tanstack/react-table";
import { DataTableDateFilter } from "../date-filter";
import { FilterGroup } from "@/lib/db/types";

// Mock scrollIntoView for test environment
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock column for testing
const createMockColumn = (): Partial<Column<any, any>> => ({
  getFilterValue: vi.fn(() => undefined),
  setFilterValue: vi.fn(),
  getFacetedUniqueValues: vi.fn(() => new Map()),
  getCanSort: vi.fn(() => true),
});

// Helper to get date inputs (uses document.body since Popover renders in portal)
// These are now text inputs from DateInput component with YYYY-MM-DD placeholder
const getDateInputs = (): HTMLInputElement[] => {
  return Array.from(document.body.querySelectorAll('input[placeholder="YYYY-MM-DD"]'));
};

describe("DataTableDateFilter - FilterGroup Integration", () => {
  describe("Reading from FilterGroup", () => {
    it("renders with no badge when no conditions exist", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Should show title but no badge
      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.queryByRole("badge")).not.toBeInTheDocument();
    });

    it("displays single condition as badge with operator and date", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">", value: "2024-01-15" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Should display badge with formatted date
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });

    it("displays date range as badge for two conditions", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">=", value: "2024-01-01" },
          { column: "latest_status_change", operator: "<=", value: "2024-12-31" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Should display range format
      expect(screen.getByText(/Jan 1 - Dec 31/)).toBeInTheDocument();
    });

    it("displays count badge for more than 2 conditions", () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: "!=", value: "2024-01-01" },
          { column: "latest_status_change", operator: "!=", value: "2024-06-15" },
          { column: "latest_status_change", operator: "!=", value: "2024-12-31" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Should display "3 conditions"
      expect(screen.getByText("3 conditions")).toBeInTheDocument();
    });
  });

  describe("Writing to FilterGroup", () => {
    it("writes single condition to filterGroup on apply", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Add condition
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      // Set operator and value
      await waitFor(() => {
        const operatorSelect = screen.getByRole("combobox");
        fireEvent.click(operatorSelect);
      });

      await waitFor(() => {
        const afterOption = screen.getByText("after");
        fireEvent.click(afterOption);
      });

      // Set date value using container query
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should call onFilterGroupChange with new condition
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">", value: "2024-06-15" },
        ],
      });
    });

    it("writes multiple conditions (date range) to filterGroup", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Add first condition (>= start)
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      // Add second condition (<= end)
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add another condition/i });
        fireEvent.click(addButton);
      });

      // Set dates
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(2);
        fireEvent.change(dateInputs[0], { target: { value: "2024-01-01" } });
        fireEvent.change(dateInputs[1], { target: { value: "2024-12-31" } });
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should call onFilterGroupChange with both conditions
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: "=", value: "2024-01-01" },
          { column: "latest_status_change", operator: "=", value: "2024-12-31" },
        ],
      });
    });

    it("preserves other columns' conditions when adding date filter", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
          { column: "amount", operator: ">", value: 1000 },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover and add condition
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      // Set date
      await waitFor(() => {
        const dateInputs = getDateInputs();
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      // Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should preserve existing conditions
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
          { column: "amount", operator: ">", value: 1000 },
          { column: "latest_status_change", operator: "=", value: "2024-06-15" },
        ],
      });
    });

    it("removes all date conditions for column when clearing", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">=", value: "2024-01-01" },
          { column: "latest_status_change", operator: "<=", value: "2024-12-31" },
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Clear all
      await waitFor(() => {
        const clearButton = screen.getByText(/clear all/i);
        fireEvent.click(clearButton);
      });

      // Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should remove date conditions but keep status
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      });
    });
  });

  describe("Transaction Pattern", () => {
    it("maintains pending state isolation until Apply", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">", value: "2024-01-15" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Add another condition
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add another condition/i });
        fireEvent.click(addButton);
      });

      // Cancel instead of apply
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Should NOT call onFilterGroupChange
      expect(onFilterGroupChange).not.toHaveBeenCalled();

      // Badge should still show original condition
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    });

    it("syncs pending conditions when popover reopens", async () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">", value: "2024-01-15" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      const { rerender } = render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Should show 1 condition with the date value
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        expect(dateInputs[0].value).toBe("2024-01-15");
      });

      // Close popover
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Change filterGroup externally
      const newFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: "<", value: "2024-06-30" },
        ],
      };

      rerender(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={newFilterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Open popover again
      fireEvent.click(trigger);

      // Should now show the new condition
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        expect(dateInputs[0].value).toBe("2024-06-30");
      });
    });
  });

  describe("Bug Regressions", () => {
    it("should NOT reset pending conditions when filterGroup prop changes while popover is open", async () => {
      /**
       * BUG: The useEffect that syncs pendingConditions from appliedConditions
       * runs whenever appliedConditions changes, even while the popover is open.
       * This wipes out user input if filterGroup gets a new reference.
       *
       * This happens in production because the columns are recalculated when
       * the parent component re-renders, creating new filterGroup references.
       */
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      const { rerender } = render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Add a condition
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      // Fill in the date value
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      // Verify the date was entered
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs[0].value).toBe("2024-06-15");
      });

      // Simulate filterGroup prop changing to a NEW object (same content, new reference)
      // This happens in production when parent re-renders with new column definitions
      const newFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],  // Still empty, but new object reference
      };

      rerender(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={newFilterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // BUG CHECK: The date input should STILL have the user's input
      // If the bug exists, this will be empty because pendingConditions was reset
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        expect(dateInputs[0].value).toBe("2024-06-15");
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should call onFilterGroupChange with the user's condition
      expect(onFilterGroupChange).toHaveBeenCalledTimes(1);
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: "=", value: "2024-06-15" },
        ],
      });
    });
  });

  describe("UI Interactions", () => {
    it("allows removing individual conditions", async () => {
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: ">=", value: "2024-01-01" },
          { column: "latest_status_change", operator: "<=", value: "2024-12-31" },
        ],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={vi.fn()}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Should have 2 date inputs
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(2);
      });

      // Find and click the first trash button to remove first condition
      const trashButtons = document.body.querySelectorAll('button[type="button"]');
      const removeButton = Array.from(trashButtons).find(btn =>
        btn.querySelector('svg.lucide-trash2')
      );
      expect(removeButton).toBeTruthy();
      fireEvent.click(removeButton!);

      // Should now have 1 date input
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
      });
    });

    it("filters out empty conditions on apply", async () => {
      const onFilterGroupChange = vi.fn();
      const filterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const column = createMockColumn() as Column<any, any>;
      render(
        <DataTableDateFilter
          column={column}
          title="Date"
          filterGroup={filterGroup}
          onFilterGroupChange={onFilterGroupChange}
          columnName="latest_status_change"
        />
      );

      // Open popover
      const trigger = screen.getByRole("button", { name: /date/i });
      fireEvent.click(trigger);

      // Add two conditions
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add another condition/i });
        fireEvent.click(addButton);
      });

      // Only fill in first date
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(2);
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
        // Leave second one empty
      });

      // Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // Should only have one condition (empty filtered out)
      expect(onFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "latest_status_change", operator: "=", value: "2024-06-15" },
        ],
      });
    });
  });
});
