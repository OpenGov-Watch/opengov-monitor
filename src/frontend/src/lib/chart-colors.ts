/**
 * Deterministic color assignment utilities for charts.
 *
 * Ensures the same category name always gets the same color,
 * regardless of sort order or data changes.
 */

export const DEFAULT_CHART_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#0088fe",
  "#00c49f",
  "#ffbb28",
  "#ff8080",
  "#a4de6c",
  "#d0ed57",
];

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
