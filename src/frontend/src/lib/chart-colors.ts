/**
 * Deterministic color assignment utilities for charts.
 *
 * Ensures the same category name always gets the same color,
 * regardless of sort order or data changes.
 */

// Sophisticated palette - balanced saturation for light and dark backgrounds
export const DEFAULT_CHART_COLORS = [
  "#9D8CD6", // soft purple
  "#5BAD7A", // balanced green
  "#D4A54A", // warm gold
  "#D4756A", // coral
  "#5A8FC4", // medium blue
  "#4AADA8", // teal
  "#C49A5A", // amber
  "#C4707A", // rose
  "#6DB56D", // fresh green
  "#A8A052", // golden olive
];

/**
 * Fixed color mappings for specific categories.
 * These override the hash-based color assignment for semantic consistency.
 */
// Semantic category colors - balanced saturation
export const CATEGORY_COLOR_OVERRIDES: Record<string, string> = {
  Outreach: "#5A8FC4", // medium blue
  Development: "#C95D5D", // balanced red
  Economy: "#5BAD7A", // balanced green
  "Business Development": "#D4A54A", // warm gold
  "Talent & Education": "#9D8CD6", // soft purple
  Operations: "#D4756A", // coral
  Research: "#5AADC4", // sky blue
};

/**
 * djb2 hash algorithm - fast and good distribution for strings.
 * Returns a positive integer hash for the given string.
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Ensure positive value
  return hash >>> 0;
}

/**
 * Get a deterministic color index for a category name.
 * Same name always returns same index.
 */
export function getCategoryColorIndex(
  categoryName: string,
  paletteSize: number
): number {
  return djb2Hash(categoryName) % paletteSize;
}

/**
 * Build a color map for a list of categories.
 * Handles collisions by assigning the next available color.
 *
 * @param categories - List of category names
 * @param palette - Color palette to use
 * @returns Map of category name to color
 */
export function buildCategoryColorMap(
  categories: string[],
  palette: string[] = DEFAULT_CHART_COLORS
): Record<string, string> {
  const colorMap: Record<string, string> = {};
  const usedColors = new Set<number>();

  for (const category of categories) {
    // Check for override first
    if (CATEGORY_COLOR_OVERRIDES[category]) {
      colorMap[category] = CATEGORY_COLOR_OVERRIDES[category];
      continue;
    }

    // Fall back to hash-based assignment
    let colorIndex = getCategoryColorIndex(category, palette.length);

    // Handle collisions: find next available color
    let attempts = 0;
    while (usedColors.has(colorIndex) && attempts < palette.length) {
      colorIndex = (colorIndex + 1) % palette.length;
      attempts++;
    }

    usedColors.add(colorIndex);
    colorMap[category] = palette[colorIndex];
  }

  return colorMap;
}
