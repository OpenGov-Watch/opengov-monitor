import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { generateColumns } from "../auto-columns";
import { FilterGroup } from "@/lib/db/types";
import { __setConfigForTesting } from "@/lib/column-renderer";

// Mock scrollIntoView for test environment
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Setup column config for date detection
beforeEach(() => {
  __setConfigForTesting({
    columns: {
      validFrom: { render: "date", format: "date" },
      created_at: { render: "date", format: "date" },
    },
    tables: {},
    patterns: [],
  });
});

// Helper to get date inputs from the document body (popover renders in portal)
// These are now text inputs from DateInput component with YYYY-MM-DD placeholder
const getDateInputs = (): HTMLInputElement[] => {
  return Array.from(document.body.querySelectorAll('input[placeholder="YYYY-MM-DD"]'));
};

describe("auto-columns DateFilter integration", () => {
  /**
   * This test captures a bug where date filters applied via the column header
   * DateFilter component don't properly propagate to the filterGroup state.
   *
   * The symptom: User adds a date filter, clicks Apply, but the network request
   * shows "filters":[] - the filter wasn't actually applied.
   *
   * Root cause investigation:
   * - The DateFilter component correctly calls onFilterGroupChange
   * - But the filterGroup/onFilterGroupChange props may not be wired correctly
   *   from data-table.tsx through generateColumns to the DateFilter
   */
  describe("filterGroup integration", () => {
    it("should pass filterGroup and onFilterGroupChange to DateFilter through column header", async () => {
      const mockOnFilterGroupChange = vi.fn();
      const initialFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      // Sample data with a date column
      const data = [
        { id: 1, validFrom: "2024-01-15" },
        { id: 2, validFrom: "2024-06-30" },
      ];

      // Generate columns with filterGroup props
      const columns = generateColumns({
        data,
        tableName: "test",
        filterGroup: initialFilterGroup,
        onFilterGroupChange: mockOnFilterGroupChange,
      });

      // Find the validFrom column
      const validFromColumn = columns.find((col) => col.id === "validFrom");
      expect(validFromColumn).toBeDefined();

      // The header should be a function that returns JSX with DateFilter
      expect(typeof validFromColumn!.header).toBe("function");

      // Render the header
      const headerFn = validFromColumn!.header as any;
      const mockColumn = {
        getCanSort: () => true,
        getIsSorted: () => false,
        getSortIndex: () => -1,
        getToggleSortingHandler: () => vi.fn(),
        toggleSorting: vi.fn(),
      };

      render(headerFn({ column: mockColumn }));

      // Should have rendered the DateFilter (it has a button with the column title)
      // Note: formatColumnName converts validFrom to "Validfrom" (capitalizes first letter of each word)
      const filterButton = screen.getByRole("button", { name: /validfrom/i });
      expect(filterButton).toBeInTheDocument();

      // Open the popover
      fireEvent.click(filterButton);

      // Add a date condition
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /add date filter/i });
        fireEvent.click(addButton);
      });

      // Set operator to "after" (>)
      await waitFor(() => {
        const operatorSelect = screen.getByRole("combobox");
        fireEvent.click(operatorSelect);
      });

      await waitFor(() => {
        const afterOption = screen.getByText("after");
        fireEvent.click(afterOption);
      });

      // Set the date value
      await waitFor(() => {
        const dateInputs = getDateInputs();
        expect(dateInputs.length).toBe(1);
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      // Click Apply
      const applyButton = screen.getByRole("button", { name: /apply/i });
      fireEvent.click(applyButton);

      // CRITICAL: Verify onFilterGroupChange was called with the correct value
      // This is the bug - if this assertion fails, the filter isn't being applied
      expect(mockOnFilterGroupChange).toHaveBeenCalledTimes(1);
      expect(mockOnFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "validFrom", operator: ">", value: "2024-06-15" },
        ],
      });
    });

    it("should use filterColumnName from columnOverrides when provided", async () => {
      const mockOnFilterGroupChange = vi.fn();
      const initialFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [],
      };

      const data = [
        { id: 1, validFrom: "2024-01-15" },
      ];

      // Generate columns with a filterColumn override
      const columns = generateColumns({
        data,
        tableName: "test",
        filterGroup: initialFilterGroup,
        onFilterGroupChange: mockOnFilterGroupChange,
        columnOverrides: {
          validFrom: {
            filterColumn: "t.validFrom", // Use aliased column name for filtering
          } as any,
        },
      });

      const validFromColumn = columns.find((col) => col.id === "validFrom");
      const headerFn = validFromColumn!.header as any;
      const mockColumn = {
        getCanSort: () => true,
        getIsSorted: () => false,
        getSortIndex: () => -1,
        getToggleSortingHandler: () => vi.fn(),
        toggleSorting: vi.fn(),
      };

      render(headerFn({ column: mockColumn }));

      // Open popover and add condition
      fireEvent.click(screen.getByRole("button", { name: /validfrom/i }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: /add date filter/i }));
      });

      await waitFor(() => {
        const dateInputs = getDateInputs();
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));

      // Should use the filterColumn from override
      expect(mockOnFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "t.validFrom", operator: "=", value: "2024-06-15" },
        ],
      });
    });

    it("should preserve existing conditions from filterGroup when adding new date filter", async () => {
      const mockOnFilterGroupChange = vi.fn();
      const initialFilterGroup: FilterGroup = {
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
        ],
      };

      const data = [
        { id: 1, validFrom: "2024-01-15", status: "Active" },
      ];

      const columns = generateColumns({
        data,
        tableName: "test",
        filterGroup: initialFilterGroup,
        onFilterGroupChange: mockOnFilterGroupChange,
      });

      const validFromColumn = columns.find((col) => col.id === "validFrom");
      const headerFn = validFromColumn!.header as any;
      const mockColumn = {
        getCanSort: () => true,
        getIsSorted: () => false,
        getSortIndex: () => -1,
        getToggleSortingHandler: () => vi.fn(),
        toggleSorting: vi.fn(),
      };

      render(headerFn({ column: mockColumn }));

      // Open popover and add condition
      fireEvent.click(screen.getByRole("button", { name: /validfrom/i }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: /add date filter/i }));
      });

      await waitFor(() => {
        const dateInputs = getDateInputs();
        fireEvent.change(dateInputs[0], { target: { value: "2024-06-15" } });
      });

      fireEvent.click(screen.getByRole("button", { name: /apply/i }));

      // Should preserve existing status condition AND add new date condition
      expect(mockOnFilterGroupChange).toHaveBeenCalledWith({
        operator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Active"] },
          { column: "validFrom", operator: "=", value: "2024-06-15" },
        ],
      });
    });

    it("should render DateFilter for columns with render: date in config", () => {
      const data = [
        { id: 1, validFrom: "2024-01-15", name: "Test" },
      ];

      const columns = generateColumns({
        data,
        tableName: "test",
        filterGroup: { operator: "AND", conditions: [] },
        onFilterGroupChange: vi.fn(),
      });

      // validFrom should be a date column (from config)
      const validFromColumn = columns.find((col) => col.id === "validFrom");
      expect(validFromColumn).toBeDefined();

      // name should NOT be a date column
      const nameColumn = columns.find((col) => col.id === "name");
      expect(nameColumn).toBeDefined();

      // Render both headers
      const mockColumn = {
        getCanSort: () => true,
        getIsSorted: () => false,
        getSortIndex: () => -1,
        getToggleSortingHandler: () => vi.fn(),
        toggleSorting: vi.fn(),
      };

      // validFrom header should have date filter
      const { container: validFromContainer } = render(
        (validFromColumn!.header as any)({ column: mockColumn })
      );
      expect(validFromContainer.textContent).toContain("ValidFrom");

      // After clicking, should show "Add date filter" button
      const validFromButton = screen.getByRole("button", { name: /validfrom/i });
      fireEvent.click(validFromButton);

      // Wait for popover - should have date filter content
      expect(screen.getByRole("button", { name: /add date filter/i })).toBeInTheDocument();
    });
  });
});
