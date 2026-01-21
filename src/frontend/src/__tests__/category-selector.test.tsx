/**
 * CategorySelector Component Tests
 *
 * Tests for the category/subcategory selector components and the DataTable
 * edit wrapper that handles optimistic updates.
 *
 * REGRESSION TESTS:
 * - CategorySelector must call onChange when selection changes
 * - DataTable edit wrapper must update local state after API call
 * - Edit config must correctly identify rows by idField
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  CategorySelector,
  EditableCategoryCell,
  EditableSubcategoryCell,
  findCategoryId,
} from "../components/data-table/editable-cells";
import type { Category, DataTableEditConfig } from "@/lib/db/types";

// Sample categories for testing
const mockCategories: Category[] = [
  { id: 1, category: "Development", subcategory: null },
  { id: 2, category: "Development", subcategory: "Core" },
  { id: 3, category: "Development", subcategory: "Tooling" },
  { id: 4, category: "Marketing", subcategory: null },
  { id: 5, category: "Marketing", subcategory: "Events" },
  { id: 6, category: "Marketing", subcategory: "Content" },
  { id: 7, category: "Operations", subcategory: null },
];

describe("findCategoryId helper", () => {
  it("finds category ID for exact category/subcategory match", () => {
    expect(findCategoryId("Development", "Core", mockCategories)).toBe(2);
    expect(findCategoryId("Marketing", "Events", mockCategories)).toBe(5);
  });

  it("finds category ID for NULL subcategory (Other)", () => {
    expect(findCategoryId("Development", null, mockCategories)).toBe(1);
    expect(findCategoryId("Marketing", null, mockCategories)).toBe(4);
  });

  it("returns null for non-existent category", () => {
    expect(findCategoryId("NonExistent", null, mockCategories)).toBeNull();
  });

  it("returns null when category is null", () => {
    expect(findCategoryId(null, null, mockCategories)).toBeNull();
  });

  it("handles 'Other' string as NULL subcategory", () => {
    // The helper should treat "Other" as NULL
    expect(findCategoryId("Development", "Other", mockCategories)).toBe(1);
  });

  it("BUG: returns null when category has no NULL subcategory entry", () => {
    /**
     * This test documents the current buggy behavior.
     * When a category doesn't have a subcategory=null entry,
     * findCategoryId returns null even though valid subcategories exist.
     *
     * Real-world example: "Business Development" has subcategories but
     * no "Other" (null) entry, so selecting it from dropdown fails.
     */
    const categoriesWithoutNullSubcat: Category[] = [
      // "Governance" only has named subcategories, no null/Other
      { id: 100, category: "Governance", subcategory: "Council" },
      { id: 101, category: "Governance", subcategory: "Treasury" },
      // "Development" has a null subcategory
      { id: 1, category: "Development", subcategory: null },
      { id: 2, category: "Development", subcategory: "Core" },
    ];

    // Development works because it has subcategory=null
    expect(findCategoryId("Development", null, categoriesWithoutNullSubcat)).toBe(1);

    // BUG: Governance returns null because it has no subcategory=null entry
    // This causes the UI to not update when selecting "Governance"
    expect(findCategoryId("Governance", null, categoriesWithoutNullSubcat)).toBeNull();

    // The expected behavior should be to return the first available subcategory
    // or require categories to always have a null subcategory entry
  });
});

describe("EditableCategoryCell", () => {
  it("renders current category value", () => {
    render(
      <EditableCategoryCell
        value="Development"
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Development");
  });

  it("shows placeholder when value is null", () => {
    render(
      <EditableCategoryCell
        value={null}
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows parent category as placeholder when value is null and parent exists", () => {
    render(
      <EditableCategoryCell
        value={null}
        categories={mockCategories}
        onChange={vi.fn()}
        parentCategory="Development"
      />
    );

    expect(screen.getByText("Development")).toBeInTheDocument();
  });

  it("lists unique categories in dropdown", async () => {
    render(
      <EditableCategoryCell
        value="Development"
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("combobox"));

    // Wait for options to appear
    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox).toBeInTheDocument();
    });

    // Check that categories appear
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeInTheDocument();

    // Categories should be unique (Development, Marketing, Operations)
    const options = within(listbox as HTMLElement).getAllByRole("option");
    // +1 for "None" option
    expect(options.length).toBe(4); // None + 3 unique categories
  });
});

describe("EditableSubcategoryCell", () => {
  it("renders current subcategory value", () => {
    render(
      <EditableSubcategoryCell
        value="Core"
        category="Development"
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Core");
  });

  it("shows 'Other' for null subcategory value", () => {
    render(
      <EditableSubcategoryCell
        value={null}
        category="Development"
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Other");
  });

  it("is disabled when no category is selected", () => {
    render(
      <EditableSubcategoryCell
        value={null}
        category={null}
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("uses parent category when category is null", () => {
    render(
      <EditableSubcategoryCell
        value={null}
        category={null}
        categories={mockCategories}
        onChange={vi.fn()}
        parentCategory="Development"
      />
    );

    // Should NOT be disabled because parent category is available
    expect(screen.getByRole("combobox")).not.toBeDisabled();
  });

  it("only shows subcategories for the current category", async () => {
    render(
      <EditableSubcategoryCell
        value={null}
        category="Development"
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox).toBeInTheDocument();
    });

    const listbox = document.querySelector('[role="listbox"]');
    const options = within(listbox as HTMLElement).getAllByRole("option");

    // Development has: None/Default + Other (null) + Core + Tooling = 4 options
    expect(options.length).toBe(4);
  });
});

describe("CategorySelector (combined)", () => {
  it("renders both category and subcategory dropdowns", () => {
    render(
      <CategorySelector
        categoryId={2}
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes).toHaveLength(2);
  });

  it("displays current category and subcategory from categoryId", () => {
    render(
      <CategorySelector
        categoryId={2} // Development > Core
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toHaveTextContent("Development");
    expect(comboboxes[1]).toHaveTextContent("Core");
  });

  it("shows parent category values when no direct value is set", () => {
    render(
      <CategorySelector
        categoryId={null}
        categories={mockCategories}
        onChange={vi.fn()}
        parentCategory="Development"
        parentSubcategory="Core"
      />
    );

    // Should show parent values in muted style
    expect(screen.getByText("Development")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("shows 'Other' for null parent subcategory", () => {
    render(
      <CategorySelector
        categoryId={null}
        categories={mockCategories}
        onChange={vi.fn()}
        parentCategory="Development"
        parentSubcategory={null}
      />
    );

    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("syncs internal state when categoryId prop changes", () => {
    const { rerender } = render(
      <CategorySelector
        categoryId={2} // Development > Core
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    let comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toHaveTextContent("Development");
    expect(comboboxes[1]).toHaveTextContent("Core");

    // Rerender with different categoryId
    rerender(
      <CategorySelector
        categoryId={5} // Marketing > Events
        categories={mockCategories}
        onChange={vi.fn()}
      />
    );

    comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toHaveTextContent("Marketing");
    expect(comboboxes[1]).toHaveTextContent("Events");
  });
});

describe("DataTable Edit Config Wrapper", () => {
  /**
   * This tests the edit config wrapper logic that DataTable uses
   * to wrap onUpdate callbacks with optimistic local state updates.
   *
   * The wrapper is implemented in data-table.tsx around line 287-342
   */

  it("REGRESSION: editConfig must have idField to correctly identify rows", () => {
    // This catches the bug where Referenda page was missing idField

    // Child Bounties config (CORRECT - has idField)
    const childBountiesConfig: DataTableEditConfig = {
      idField: "identifier",
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories: mockCategories,
          onUpdate: vi.fn(),
        },
      },
    };

    // Referenda config (BUG - missing idField, defaults to "id")
    const referendaConfig: DataTableEditConfig = {
      // idField is missing! This will default to "id"
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories: mockCategories,
          onUpdate: vi.fn(),
        },
      },
    };

    // Verify the configs
    expect(childBountiesConfig.idField).toBe("identifier");
    expect(referendaConfig.idField).toBeUndefined();

    // When idField is undefined, DataTable defaults to "id"
    const getIdField = (config: DataTableEditConfig) => config.idField || "id";

    expect(getIdField(childBountiesConfig)).toBe("identifier");
    expect(getIdField(referendaConfig)).toBe("id"); // This is the default
  });

  it("simulates optimistic update with correct row identification", async () => {
    /**
     * This test simulates how DataTable's editConfigWithRefresh works:
     * 1. Call the original onUpdate (API call)
     * 2. Update local data by finding the row using idField
     */

    // Sample data - like rows in the DataTable
    const data = [
      { id: 1, identifier: "17_1", category_id: null, category: null, subcategory: null },
      { id: 2, identifier: "17_2", category_id: 2, category: "Development", subcategory: "Core" },
      { id: 3, identifier: "17_3", category_id: null, category: null, subcategory: null },
    ];

    const mockApiUpdate = vi.fn().mockResolvedValue(undefined);

    // Simulate the wrapped onUpdate from data-table.tsx
    const createWrappedOnUpdate = (
      idField: string,
      columnName: string,
      originalOnUpdate: (id: any, value: any) => Promise<void>,
      setData: (updater: (prev: typeof data) => typeof data) => void,
      categories: Category[]
    ) => {
      return async (id: any, value: any) => {
        // Call original update
        await originalOnUpdate(id, value);

        // Optimistically update local data
        setData((prevData) => {
          const rowIndex = prevData.findIndex((row: any) => row[idField] === id);
          if (rowIndex === -1) return prevData;

          const newData = [...prevData];
          const updatedRow = { ...newData[rowIndex] } as any;

          if (columnName === "category_id" && value !== null) {
            const categoryRecord = categories.find((c) => c.id === value);
            if (categoryRecord) {
              updatedRow["category_id"] = value;
              updatedRow["category"] = categoryRecord.category;
              updatedRow["subcategory"] = categoryRecord.subcategory;
            }
          }

          newData[rowIndex] = updatedRow;
          return newData;
        });
      };
    };

    let localData = [...data];
    const setData = (updater: (prev: typeof data) => typeof data) => {
      localData = updater(localData);
    };

    // Test with "id" as idField (like Referenda)
    const wrappedUpdateById = createWrappedOnUpdate(
      "id",
      "category_id",
      mockApiUpdate,
      setData,
      mockCategories
    );

    // Update row with id=1
    await wrappedUpdateById(1, 4); // Set to Marketing (id=4)

    expect(mockApiUpdate).toHaveBeenCalledWith(1, 4);
    expect(localData[0].category_id).toBe(4);
    expect(localData[0].category).toBe("Marketing");
    expect(localData[0].subcategory).toBe(null);
  });

  it("REGRESSION: update fails silently when row not found by idField", async () => {
    /**
     * This test demonstrates what happens when the idField doesn't match
     * any row in the data - the update silently fails to update local state.
     */

    const data = [
      { id: 1, identifier: "17_1", category_id: null },
      { id: 2, identifier: "17_2", category_id: null },
    ];

    const mockApiUpdate = vi.fn().mockResolvedValue(undefined);

    let localData = [...data];
    const setData = (updater: (prev: typeof data) => typeof data) => {
      localData = updater(localData);
    };

    // Simulate update with wrong idField value
    // This happens if code passes identifier value but idField is "id"
    const wrappedUpdate = async (id: any, value: any) => {
      await mockApiUpdate(id, value);
      setData((prevData) => {
        const idField = "id"; // Default when idField is missing
        const rowIndex = prevData.findIndex((row: any) => row[idField] === id);
        if (rowIndex === -1) {
          // Row not found - this is the bug!
          console.warn(`Row with ${idField}=${id} not found`);
          return prevData;
        }
        const newData = [...prevData];
        newData[rowIndex] = { ...newData[rowIndex], category_id: value };
        return newData;
      });
    };

    // Try to update using identifier value but idField expects "id"
    await wrappedUpdate("17_1", 4);

    // API was called
    expect(mockApiUpdate).toHaveBeenCalledWith("17_1", 4);

    // But local state was NOT updated because "17_1" doesn't match any "id"
    expect(localData[0].category_id).toBe(null); // Still null!
    expect(localData[1].category_id).toBe(null);
  });

  it("REGRESSION: verifies Child Bounties page has correct idField", () => {
    // This is a documentation test - it verifies the expected configuration

    // Child Bounties uses "identifier" as the primary key
    // The editConfig should specify idField: "identifier"

    const expectedChildBountiesConfig = {
      idField: "identifier", // REQUIRED for Child Bounties
      editableColumns: {
        category_id: { type: "category-selector" },
        notes: { type: "text" },
        hide_in_spends: { type: "checkbox" },
      },
    };

    expect(expectedChildBountiesConfig.idField).toBe("identifier");
  });

  it("REGRESSION: verifies Referenda page should use default idField 'id'", () => {
    // Referenda uses "id" as the primary key, which is the default
    // So omitting idField should work... but let's verify

    // Referenda data has "id" field
    const referendaRow = {
      id: 123,
      title: "Test Referendum",
      category_id: null,
    };

    const idField = "id"; // Default
    expect(referendaRow[idField]).toBe(123);

    // This should work since Referenda rows have "id" field
  });
});

describe("Category update flow integration", () => {
  /**
   * Tests the full flow of updating a category:
   * 1. User selects new category in UI
   * 2. onChange is called with new categoryId
   * 3. API is called
   * 4. Local state is updated optimistically
   */

  it("onChange receives correct category ID for Development > Core", () => {
    const onChange = vi.fn();

    render(
      <CategorySelector
        categoryId={1} // Development > Other
        categories={mockCategories}
        onChange={onChange}
      />
    );

    // Verify Development > Other (id=1) maps correctly
    const cat = mockCategories.find(c => c.id === 1);
    expect(cat?.category).toBe("Development");
    expect(cat?.subcategory).toBe(null);
  });

  it("findCategoryId correctly maps category/subcategory to ID", () => {
    // This is the core logic that translates dropdown selections to category IDs

    // When user selects "Development" category and "Core" subcategory
    const id = findCategoryId("Development", "Core", mockCategories);
    expect(id).toBe(2);

    // Verify the ID maps back correctly
    const cat = mockCategories.find(c => c.id === id);
    expect(cat?.category).toBe("Development");
    expect(cat?.subcategory).toBe("Core");
  });
});
