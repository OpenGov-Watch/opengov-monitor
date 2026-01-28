// Re-export all shared types
export * from "@opengov-monitor/shared";

// Import Category type for EditableColumnConfig
import type { Category } from "@opengov-monitor/shared";

// Frontend-specific types (not needed in API)

// Edit Config for DataTable Auto-Column Generation

export type EditableColumnType = "category-selector" | "text" | "checkbox";

export interface EditableColumnConfig {
  type: EditableColumnType;
  onUpdate: (id: string | number, value: unknown) => void | Promise<void>;
  categories?: Category[]; // For category-selector
  placeholder?: string; // For text
  // For child bounties: columns containing parent category data
  parentCategoryColumn?: string;
  parentSubcategoryColumn?: string;
}

export interface DataTableEditConfig {
  editableColumns: Record<string, EditableColumnConfig>;
  idField?: string; // Default: "id"
}
