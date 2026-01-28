/**
 * Tests for CardView component
 *
 * Key test areas:
 * - Loading overlay display
 * - Error overlay display
 * - DataTableCard rendering for each row
 * - Empty state handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { CardView } from "../components/card-view";

// Mock lucide-react icons
vi.mock("lucide-react/dist/esm/icons/loader-2", () => ({
  default: () => <div data-testid="loader-icon">Loading Icon</div>,
}));

vi.mock("lucide-react/dist/esm/icons/alert-circle", () => ({
  default: () => <div data-testid="alert-icon">Alert Icon</div>,
}));

vi.mock("lucide-react/dist/esm/icons/chevron-down", () => ({
  default: () => <div data-testid="chevron-down">Down</div>,
}));

vi.mock("lucide-react/dist/esm/icons/chevron-up", () => ({
  default: () => <div data-testid="chevron-up">Up</div>,
}));

interface TestData {
  id: number;
  title: string;
  status: string;
  amount: number;
}

const columnHelper = createColumnHelper<TestData>();

const testColumns: ColumnDef<TestData>[] = [
  columnHelper.accessor("id", { header: "ID" }),
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("amount", { header: "Amount" }),
];

const testData: TestData[] = [
  { id: 1, title: "Item 1", status: "Active", amount: 100 },
  { id: 2, title: "Item 2", status: "Pending", amount: 200 },
];

// Wrapper component to get Row objects from React Table
function TestCardView({
  data = testData,
  loading = false,
  error = null,
}: {
  data?: TestData[];
  loading?: boolean;
  error?: string | null;
}) {
  const table = useReactTable({
    data,
    columns: testColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  return <CardView rows={rows} loading={loading} error={error} />;
}

describe("CardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading overlay when loading", () => {
      render(<TestCardView loading={true} />);

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("applies opacity to content when loading", () => {
      const { container } = render(<TestCardView loading={true} />);

      const contentDiv = container.querySelector(".opacity-30");
      expect(contentDiv).toBeInTheDocument();
    });

    it("does not show loading overlay when not loading", () => {
      render(<TestCardView loading={false} />);

      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error overlay with message", () => {
      render(<TestCardView error="Something went wrong" />);

      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
      expect(screen.getByText("Error: Something went wrong")).toBeInTheDocument();
    });

    it("does not show error overlay when no error", () => {
      render(<TestCardView error={null} />);

      expect(screen.queryByTestId("alert-icon")).not.toBeInTheDocument();
    });
  });

  describe("Card Rendering", () => {
    it("renders a card for each row", () => {
      render(<TestCardView />);

      // DataTableCard shows first 3 columns as primary info
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });

    it("renders primary cell values", () => {
      render(<TestCardView />);

      // ID values
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();

      // Titles
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();

      // Status
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("shows expand button for rows with more than 3 columns", () => {
      render(<TestCardView />);

      // Should have "Show details" buttons (one per card)
      const showDetailsButtons = screen.getAllByText("Show details");
      expect(showDetailsButtons).toHaveLength(2);
    });
  });

  describe("Empty State", () => {
    it("shows no results message when rows is empty", () => {
      render(<TestCardView data={[]} />);

      expect(screen.getByText("No results.")).toBeInTheDocument();
    });
  });

  describe("Both Loading and Error", () => {
    it("shows both overlays when both states are active", () => {
      render(<TestCardView loading={true} error="Some error" />);

      // Both overlays should be present
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
    });
  });
});
