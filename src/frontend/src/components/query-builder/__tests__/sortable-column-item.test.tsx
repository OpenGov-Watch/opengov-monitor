import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableColumnItem } from "../sortable-column-item";
import type { UnifiedColumn } from "@/lib/unified-column-utils";

// Wrapper to provide required DnD context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DndContext>
      <SortableContext items={["test-col"]} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

describe("SortableColumnItem", () => {
  const mockOnUpdate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Regular columns", () => {
    const regularColumn: UnifiedColumn = {
      type: "regular",
      column: "test_table.test_column",
    };

    it("renders delete button when onRemove is provided", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={regularColumn}
            displayName="Test Column"
            onUpdate={mockOnUpdate}
            onRemove={mockOnRemove}
          />
        </TestWrapper>
      );

      // Find the delete button (trash icon button)
      const deleteButtons = screen.getAllByRole("button");
      // One is the drag handle, others could be the delete button
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector("svg.lucide-trash2")
      );

      expect(trashButton).toBeDefined();
    });

    it("does not render delete button when onRemove is not provided", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={regularColumn}
            displayName="Test Column"
            onUpdate={mockOnUpdate}
          />
        </TestWrapper>
      );

      // Find all buttons
      const deleteButtons = screen.getAllByRole("button");
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector("svg.lucide-trash2")
      );

      expect(trashButton).toBeUndefined();
    });

    it("calls onRemove when delete button is clicked", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={regularColumn}
            displayName="Test Column"
            onUpdate={mockOnUpdate}
            onRemove={mockOnRemove}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole("button");
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector("svg.lucide-trash2")
      );

      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it("displays column name and path", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={regularColumn}
            displayName="Test Column"
            onUpdate={mockOnUpdate}
          />
        </TestWrapper>
      );

      expect(screen.getByText("Test Column")).toBeInTheDocument();
      expect(screen.getByText("test_table.test_column")).toBeInTheDocument();
    });
  });

  describe("Expression columns", () => {
    const expressionColumn: UnifiedColumn = {
      type: "expression",
      alias: "total_amount",
      expression: "amount",
      aggregateFunction: "SUM",
    };

    it("renders delete button when onRemove is provided", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={expressionColumn}
            displayName="total_amount"
            onUpdate={mockOnUpdate}
            onRemove={mockOnRemove}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole("button");
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector("svg.lucide-trash2")
      );

      expect(trashButton).toBeDefined();
    });

    it("calls onRemove when delete button is clicked", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={expressionColumn}
            displayName="total_amount"
            onUpdate={mockOnUpdate}
            onRemove={mockOnRemove}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole("button");
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector("svg.lucide-trash2")
      );

      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it("displays alias and expression", () => {
      render(
        <TestWrapper>
          <SortableColumnItem
            column={expressionColumn}
            displayName="total_amount"
            onUpdate={mockOnUpdate}
          />
        </TestWrapper>
      );

      // Expression columns render alias and expression as text (not inputs) by default
      expect(screen.getByText("total_amount")).toBeInTheDocument();
      expect(screen.getByText("amount")).toBeInTheDocument();
    });
  });
});
