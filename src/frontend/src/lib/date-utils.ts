/**
 * Date parsing and validation utilities for partial date support
 *
 * Supports partial dates: YYYY, YYYY-MM, YYYY-MM-DD
 */

export interface ParsedPartialDate {
  year: number;
  month?: number; // 1-12 (human readable)
  day?: number; // 1-31
}

/**
 * Parse a partial date string into its components.
 * Accepts: YYYY, YYYY-MM, YYYY-MM-DD
 * Returns null if invalid.
 */
export function parsePartialDate(value: string): ParsedPartialDate | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Match YYYY, YYYY-MM, or YYYY-MM-DD
  const yearOnlyMatch = /^(\d{4})$/.exec(trimmed);
  const yearMonthMatch = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  const fullDateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);

  if (fullDateMatch) {
    const year = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10);
    const day = parseInt(fullDateMatch[3], 10);

    // Validate ranges
    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    // Validate day for month (basic check)
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return null;

    return { year, month, day };
  }

  if (yearMonthMatch) {
    const year = parseInt(yearMonthMatch[1], 10);
    const month = parseInt(yearMonthMatch[2], 10);

    if (year < 1900 || year > 2100) return null;
    if (month < 1 || month > 12) return null;

    return { year, month };
  }

  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);

    if (year < 1900 || year > 2100) return null;

    return { year };
  }

  return null;
}

/**
 * Check if a string is a valid partial date (YYYY, YYYY-MM, or YYYY-MM-DD)
 */
export function isValidPartialDate(value: string): boolean {
  return parsePartialDate(value) !== null;
}

/**
 * Format a partial date for display.
 * - Full date: "Jan 15" (short format)
 * - Year-month: "Jun 2024"
 * - Year only: "2024"
 */
export function formatPartialDateForDisplay(value: string): string {
  if (!value) return "";

  const parsed = parsePartialDate(value);
  if (!parsed) {
    // Try parsing as ISO date
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } catch {
      // Ignore
    }
    return value;
  }

  const { year, month, day } = parsed;

  if (month && day) {
    // Full date - show "Jan 15"
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (month) {
    // Year-month - show "Jun 2024"
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  // Year only
  return String(year);
}

/**
 * Check if a date string is a partial date (year only or year-month).
 * Full dates (YYYY-MM-DD) return false.
 */
export function isPartialDate(value: string): boolean {
  const parsed = parsePartialDate(value);
  if (!parsed) return false;
  // Partial if missing day
  return parsed.day === undefined;
}

/**
 * Get date range boundaries for a partial date.
 * Used for expanding partial dates in filters.
 *
 * For "2024": { start: "2024-01-01", end: "2024-12-31" }
 * For "2024-06": { start: "2024-06-01", end: "2024-06-30" }
 * For full dates, returns the same date for both.
 */
export function getPartialDateRange(
  value: string
): { start: string; end: string } | null {
  const parsed = parsePartialDate(value);
  if (!parsed) return null;

  const { year, month, day } = parsed;

  if (day !== undefined && month !== undefined) {
    // Full date
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { start: dateStr, end: dateStr };
  }

  if (month !== undefined) {
    // Year-month: first day to last day of month
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    return { start: startDate, end: endDate };
  }

  // Year only: Jan 1 to Dec 31
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

/**
 * Get the "next" boundary date for partial date comparisons.
 * Used for > (after) operator on partial dates.
 *
 * For "2024": returns "2025-01-01" (first day after the year)
 * For "2024-06": returns "2024-07-01" (first day after the month)
 * For full dates: returns next day
 */
export function getNextBoundary(value: string): string | null {
  const parsed = parsePartialDate(value);
  if (!parsed) return null;

  const { year, month, day } = parsed;

  if (day !== undefined && month !== undefined) {
    // Full date - next day
    const date = new Date(year, month - 1, day + 1);
    return formatDateForAPI(date);
  }

  if (month !== undefined) {
    // Year-month - first day of next month
    const date = new Date(year, month, 1);
    return formatDateForAPI(date);
  }

  // Year only - first day of next year
  return `${year + 1}-01-01`;
}

/**
 * Get the "previous" boundary date for partial date comparisons.
 * Used for < (before) operator on partial dates.
 *
 * For "2024": returns "2023-12-31" (last day before the year)
 * For "2024-06": returns "2024-05-31" (last day before the month)
 * For full dates: returns previous day
 */
export function getPreviousBoundary(value: string): string | null {
  const parsed = parsePartialDate(value);
  if (!parsed) return null;

  const { year, month, day } = parsed;

  if (day !== undefined && month !== undefined) {
    // Full date - previous day
    const date = new Date(year, month - 1, day - 1);
    return formatDateForAPI(date);
  }

  if (month !== undefined) {
    // Year-month - last day of previous month
    const date = new Date(year, month - 1, 0);
    return formatDateForAPI(date);
  }

  // Year only - last day of previous year
  return `${year - 1}-12-31`;
}

/**
 * Format a Date object as YYYY-MM-DD for API usage
 */
function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
