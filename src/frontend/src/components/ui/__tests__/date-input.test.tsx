/**
 * DateInput Component Tests
 *
 * Tests for the DateInput component which accepts partial dates (YYYY, YYYY-MM, YYYY-MM-DD).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DateInput } from "../date-input";

describe("DateInput", () => {
  describe("Rendering", () => {
    it("renders with default placeholder", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");
      expect(input).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      render(
        <DateInput value="" onChange={vi.fn()} placeholder="Enter date..." />
      );
      const input = screen.getByPlaceholderText("Enter date...");
      expect(input).toBeInTheDocument();
    });

    it("renders with initial value", () => {
      render(<DateInput value="2024-06-15" onChange={vi.fn()} />);
      const input = screen.getByDisplayValue("2024-06-15");
      expect(input).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <DateInput value="" onChange={vi.fn()} className="custom-class" />
      );
      const input = screen.getByPlaceholderText("YYYY-MM-DD");
      expect(input).toHaveClass("custom-class");
    });
  });

  describe("Value Changes", () => {
    it("calls onChange when value changes", () => {
      const onChange = vi.fn();
      render(<DateInput value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText("YYYY-MM-DD");
      fireEvent.change(input, { target: { value: "2024" } });

      expect(onChange).toHaveBeenCalledWith("2024");
    });

    it("allows typing partial dates", () => {
      const onChange = vi.fn();
      render(<DateInput value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      // Type year
      fireEvent.change(input, { target: { value: "2024" } });
      expect(onChange).toHaveBeenCalledWith("2024");

      // Type year-month
      fireEvent.change(input, { target: { value: "2024-06" } });
      expect(onChange).toHaveBeenCalledWith("2024-06");

      // Type full date
      fireEvent.change(input, { target: { value: "2024-06-15" } });
      expect(onChange).toHaveBeenCalledWith("2024-06-15");
    });

    it("syncs local state when external value changes", async () => {
      const { rerender } = render(
        <DateInput value="2024-01" onChange={vi.fn()} />
      );

      const input = screen.getByDisplayValue("2024-01");
      expect(input).toBeInTheDocument();

      // Change external value
      rerender(<DateInput value="2024-06-15" onChange={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("2024-06-15")).toBeInTheDocument();
      });
    });
  });

  describe("Validation", () => {
    it("shows valid state for empty input", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      // Should not have red border
      expect(input).not.toHaveClass("border-red-500");
    });

    it("shows valid state for valid year", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "2024" } });
      fireEvent.blur(input);

      expect(input).not.toHaveClass("border-red-500");
    });

    it("shows valid state for valid year-month", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "2024-06" } });
      fireEvent.blur(input);

      expect(input).not.toHaveClass("border-red-500");
    });

    it("shows valid state for valid full date", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "2024-06-15" } });
      fireEvent.blur(input);

      expect(input).not.toHaveClass("border-red-500");
    });

    it("shows invalid state for invalid date on blur", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "not-a-date" } });
      fireEvent.blur(input);

      expect(input).toHaveClass("border-red-500");
    });

    it("shows invalid state for invalid month", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "2024-13" } });
      fireEvent.blur(input);

      expect(input).toHaveClass("border-red-500");
    });

    it("shows invalid state for invalid day", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      fireEvent.change(input, { target: { value: "2024-02-30" } });
      fireEvent.blur(input);

      expect(input).toHaveClass("border-red-500");
    });

    it("clears invalid state when value becomes valid", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");

      // Make invalid
      fireEvent.change(input, { target: { value: "invalid" } });
      fireEvent.blur(input);
      expect(input).toHaveClass("border-red-500");

      // Make valid
      fireEvent.change(input, { target: { value: "2024" } });
      fireEvent.blur(input);
      expect(input).not.toHaveClass("border-red-500");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty string value", () => {
      render(<DateInput value="" onChange={vi.fn()} />);
      const input = screen.getByPlaceholderText("YYYY-MM-DD");
      expect(input).toHaveValue("");
    });

    it("handles single digit month input", () => {
      const onChange = vi.fn();
      render(<DateInput value="" onChange={onChange} />);

      const input = screen.getByPlaceholderText("YYYY-MM-DD");
      fireEvent.change(input, { target: { value: "2024-6" } });
      fireEvent.blur(input);

      expect(input).not.toHaveClass("border-red-500");
    });

    it("handles clearing the input", () => {
      const onChange = vi.fn();
      render(<DateInput value="2024-06-15" onChange={onChange} />);

      const input = screen.getByDisplayValue("2024-06-15");
      fireEvent.change(input, { target: { value: "" } });

      expect(onChange).toHaveBeenCalledWith("");
      fireEvent.blur(input);
      expect(input).not.toHaveClass("border-red-500");
    });
  });
});
