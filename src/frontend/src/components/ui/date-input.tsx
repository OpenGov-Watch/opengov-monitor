"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { isValidPartialDate } from "@/lib/date-utils";

export interface DateInputProps {
  /** Current value (YYYY, YYYY-MM, or YYYY-MM-DD format) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Placeholder text (default: "YYYY-MM-DD") */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A text input for date values that accepts partial dates (YYYY, YYYY-MM, YYYY-MM-DD).
 * Shows validation feedback with red border when invalid.
 */
export function DateInput({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  className,
}: DateInputProps) {
  // Local state for immediate input feedback
  const [localValue, setLocalValue] = React.useState(value);
  const [isValid, setIsValid] = React.useState(true);

  // Sync local state when external value changes (e.g., reset)
  React.useEffect(() => {
    setLocalValue(value);
    // Validate the new external value
    if (value === "" || isValidPartialDate(value)) {
      setIsValid(true);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Always propagate changes immediately for controlled input behavior
    onChange(newValue);

    // Update validation state for visual feedback
    if (newValue === "" || isValidPartialDate(newValue)) {
      setIsValid(true);
    }
  };

  const handleBlur = () => {
    // Validate on blur and update visual feedback
    if (localValue === "" || isValidPartialDate(localValue)) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        !isValid && "border-red-500 focus-visible:ring-red-500",
        className
      )}
    />
  );
}
