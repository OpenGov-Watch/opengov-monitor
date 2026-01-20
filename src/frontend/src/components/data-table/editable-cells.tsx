import { useState, useEffect, useMemo } from "react";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/db/types";

interface EditableCategoryCellProps {
  value: string | null;
  categories: Category[];
  onChange: (category: string | null) => void;
  parentCategory?: string | null;
}

export function EditableCategoryCell({
  value,
  categories,
  onChange,
  parentCategory,
}: EditableCategoryCellProps) {
  const uniqueCategories = [...new Set(categories.map((c) => c.category).filter(c => c && c !== ""))].sort();

  return (
    <Select
      value={value && value !== "" ? value : "__none__"}
      onValueChange={(val) => onChange(val === "__none__" ? null : val)}
    >
      <SelectTrigger className="h-8 w-[140px] text-left">
        {!value && parentCategory ? (
          <span className="text-muted-foreground truncate">{parentCategory}</span>
        ) : (
          <SelectValue placeholder="Select..." />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {uniqueCategories.map((cat) => (
          <SelectItem key={cat} value={cat}>
            {cat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface EditableSubcategoryCellProps {
  value: string | null;
  category: string | null;
  categories: Category[];
  onChange: (subcategory: string | null) => void;
  parentCategory?: string | null;
  parentSubcategory?: string | null;
}

export function EditableSubcategoryCell({
  value,
  category,
  categories,
  onChange,
  parentCategory,
  parentSubcategory,
}: EditableSubcategoryCellProps) {
  // Use selected category, or fall back to parent category for subcategory filtering
  const effectiveCategory = category || parentCategory || null;
  // Get all subcategories for the effective category, including NULL (Other)
  const availableSubcategories = categories
    .filter((c) => c.category === effectiveCategory)
    .map((c) => c.subcategory)
    // Sort: non-null values alphabetically, NULL (Other) at end
    .sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

  // Display value: NULL -> "Other"
  const displayValue = value === null ? "Other" : value;

  return (
    <Select
      value={displayValue && displayValue !== "" ? displayValue : "__none__"}
      onValueChange={(val) => {
        if (val === "__none__") {
          onChange(null);
        } else if (val === "Other") {
          // "Other" in UI = NULL in database
          onChange(null);
        } else {
          onChange(val);
        }
      }}
      disabled={!effectiveCategory}
    >
      <SelectTrigger className="h-8 w-[160px] text-left">
        {!value && !category && parentSubcategory ? (
          <span className="text-muted-foreground truncate">
            {parentSubcategory === null ? "Other" : parentSubcategory}
          </span>
        ) : (
          <SelectValue placeholder={effectiveCategory ? "Select..." : "Select category first"} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {availableSubcategories.map((sub) => (
          <SelectItem key={sub === null ? "__other__" : sub} value={sub === null ? "Other" : sub}>
            {sub === null ? "Other" : sub}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface EditableNotesCellProps {
  value: string | null;
  onChange: (notes: string | null) => void;
}

export function EditableNotesCell({ value, onChange }: EditableNotesCellProps) {
  const [localValue, setLocalValue] = useState(value || "");

  // Sync local value when prop changes (e.g., after external update)
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  return (
    <Input
      className="h-8 w-[120px]"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        const newValue = localValue.trim() || null;
        if (newValue !== value) {
          onChange(newValue);
        }
      }}
      placeholder="Notes..."
    />
  );
}

interface EditableHideCheckboxProps {
  value: number | null;
  onChange: (hide: number) => void;
}

export function EditableHideCheckbox({
  value,
  onChange,
}: EditableHideCheckboxProps) {
  return (
    <Checkbox
      checked={value === 1}
      onCheckedChange={(checked) => onChange(checked ? 1 : 0)}
    />
  );
}

// Combined Category Selector with cascading dropdowns
// [Category] > [Subcategory]
interface CategorySelectorProps {
  categoryId: number | null;
  categories: Category[];
  onChange: (categoryId: number | null) => void;
  parentCategory?: string | null;
  parentSubcategory?: string | null;
}

export function CategorySelector({
  categoryId,
  categories,
  onChange,
  parentCategory,
  parentSubcategory,
}: CategorySelectorProps) {
  // Create Map for O(1) lookups by ID
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const current = categoryMap.get(categoryId ?? -1);
  const [selectedCat, setSelectedCat] = useState<string | null>(
    current?.category || null
  );

  // Sync selected category when categoryId prop changes
  useEffect(() => {
    const cat = categoryMap.get(categoryId ?? -1);
    setSelectedCat(cat?.category || null);
  }, [categoryId, categoryMap]);

  const uniqueCategories = useMemo(
    () => [...new Set(categories.map((c) => c.category))].sort(),
    [categories]
  );
  // Use selected category, or fall back to parent category for subcategory filtering
  const effectiveCategory = selectedCat || parentCategory || null;
  const availableSubcategories = useMemo(
    () => categories
      .filter((c) => c.category === effectiveCategory)
      // Sort: non-null values alphabetically, NULL (Other) at end
      .sort((a, b) => {
        if (a.subcategory === null) return 1;
        if (b.subcategory === null) return -1;
        return a.subcategory.localeCompare(b.subcategory);
      }),
    [categories, effectiveCategory]
  );

  const handleCategoryChange = (cat: string | null) => {
    if (!cat) {
      handleCategoryNone();
      return;
    }

    setSelectedCat(cat);
    const current = categories.find((c) => c.id === categoryId);
    const currentSubcategory = current?.subcategory;
    const subs = categories.filter((c) => c.category === cat);

    // If current subcategory exists in new category → keep it
    const subcategoryExists = subs.some((s) => s.subcategory === currentSubcategory);
    if (subcategoryExists && currentSubcategory !== undefined) {
      const catId = findCategoryId(cat, currentSubcategory, categories);
      onChange(catId);
    } else {
      // Default to "Other" (NULL subcategory)
      const otherCatId = findCategoryId(cat, null, categories);
      onChange(otherCatId !== null ? otherCatId : subs[0]?.id || null);
    }
  };

  const handleCategoryNone = () => {
    setSelectedCat(null);
    if (!parentCategory) {
      onChange(null);
      return;
    }

    // Check if current subcategory is valid for parent category
    const current = categories.find((c) => c.id === categoryId);
    const currentSubcategory = current?.subcategory;
    const parentSubcats = categories.filter((c) => c.category === parentCategory);
    const subcatValid = parentSubcats.some((s) => s.subcategory === currentSubcategory);

    if (subcatValid && currentSubcategory) {
      const catId = findCategoryId(parentCategory, currentSubcategory, categories);
      onChange(catId);
    } else if (parentSubcategory) {
      const catId = findCategoryId(parentCategory, parentSubcategory, categories);
      onChange(catId);
    } else {
      onChange(null);
    }
  };

  return (
    <div className="flex items-center gap-1 min-w-[280px]">
      {/* Category Dropdown */}
      <Select
        value={selectedCat || "__none__"}
        onValueChange={(val) =>
          handleCategoryChange(val === "__none__" ? null : val)
        }
      >
        <SelectTrigger className="h-8 w-[120px] text-xs">
          {/* Show parent category as grayed placeholder when None selected */}
          {!selectedCat && parentCategory ? (
            <span className="text-muted-foreground truncate">{parentCategory}</span>
          ) : (
            <SelectValue placeholder="None" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          {uniqueCategories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Chevron separator */}
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* Subcategory Dropdown */}
      <Select
        value={categoryId?.toString() || "__none__"}
        onValueChange={(val) => {
          if (val === "__none__") {
            // Use effectiveCategory (selected or inherited) to find "Other" (NULL subcategory)
            const otherCatId = findCategoryId(effectiveCategory, null, categories);
            onChange(otherCatId !== null ? otherCatId : null);
          } else {
            onChange(parseInt(val));
          }
        }}
        disabled={!effectiveCategory}
      >
        <SelectTrigger
          className={cn("h-8 w-[140px] text-xs", !effectiveCategory && "opacity-50")}
        >
          {/* Show parent subcategory as grayed placeholder when using inherited category */}
          {!selectedCat && parentSubcategory !== undefined && !categoryId ? (
            <span className="text-muted-foreground truncate">
              {parentSubcategory === null ? "Other" : parentSubcategory}
            </span>
          ) : (
            <SelectValue placeholder="None" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          {availableSubcategories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id.toString()}>
              {cat.subcategory === null ? "Other" : cat.subcategory}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Read-only display components for unauthenticated users

interface ReadOnlyCategorySelectorProps {
  categoryId: number | null;
  categories: Category[];
  parentCategory?: string | null;
  parentSubcategory?: string | null;
}

export function ReadOnlyCategorySelector({
  categoryId,
  categories,
  parentCategory,
  parentSubcategory,
}: ReadOnlyCategorySelectorProps) {
  // Create Map for O(1) lookup by ID
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const current = categoryMap.get(categoryId ?? -1);

  if (!current && (parentCategory || parentSubcategory !== undefined)) {
    return (
      <span className="text-xs text-muted-foreground">
        {parentCategory || ""}
        {parentSubcategory !== undefined && (
          <>
            <ChevronRight className="inline h-3 w-3 mx-0.5" />
            {parentSubcategory === null ? "Other" : parentSubcategory}
          </>
        )}
      </span>
    );
  }

  if (!current) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  return (
    <span className="text-xs">
      {current.category}
      <ChevronRight className="inline h-3 w-3 mx-0.5 text-muted-foreground" />
      {current.subcategory === null ? "Other" : current.subcategory}
    </span>
  );
}

interface ReadOnlyNotesCellProps {
  value: string | null;
}

export function ReadOnlyNotesCell({ value }: ReadOnlyNotesCellProps) {
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="text-sm max-w-[120px] truncate block" title={value}>
      {value}
    </span>
  );
}

interface ReadOnlyHideCheckboxProps {
  value: number | null;
}

export function ReadOnlyHideCheckbox({ value }: ReadOnlyHideCheckboxProps) {
  return <Checkbox checked={value === 1} disabled className="opacity-60" />;
}

// Helper function to display subcategory: NULL -> "Other"
export function displaySubcategory(subcategory: string | null): string {
  return subcategory === null ? "Other" : subcategory;
}

// Helper function to find category_id for a given category/subcategory combination
// "Other" subcategory maps to NULL in the database
export function findCategoryId(
  category: string | null,
  subcategory: string | null,
  categories: Category[]
): number | null {
  if (!category) return null;

  // "Other" subcategory = NULL subcategory in DB
  const normalizedSubcategory = subcategory === "Other" ? null : subcategory;

  // If subcategory provided (or "Other"), find exact match
  if (normalizedSubcategory !== null) {
    const match = categories.find(
      (c) => c.category === category && c.subcategory === normalizedSubcategory
    );
    return match?.id ?? null;
  }

  // Find NULL subcategory (Other)
  const match = categories.find(
    (c) => c.category === category && c.subcategory === null
  );
  return match?.id ?? null;
}

// Read-only display for split category column
interface ReadOnlyCategoryCellProps {
  value: string | null;
  parentCategory?: string | null;
}

export function ReadOnlyCategoryCell({ value, parentCategory }: ReadOnlyCategoryCellProps) {
  if (!value && parentCategory) {
    return <span className="text-muted-foreground text-xs">{parentCategory}</span>;
  }
  if (!value) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  return <span className="text-xs">{value}</span>;
}

// Read-only display for split subcategory column
interface ReadOnlySubcategoryCellProps {
  value: string | null;
  parentSubcategory?: string | null;
}

export function ReadOnlySubcategoryCell({ value, parentSubcategory }: ReadOnlySubcategoryCellProps) {
  // Display "Other" for NULL subcategory
  const displayValue = value === null ? "Other" : value;
  const displayParent = parentSubcategory === null ? "Other" : parentSubcategory;

  if (!displayValue && displayParent) {
    return <span className="text-muted-foreground text-xs">{displayParent}</span>;
  }
  if (!displayValue) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  return <span className="text-xs">{displayValue}</span>;
}
