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
}

export function EditableCategoryCell({
  value,
  categories,
  onChange,
}: EditableCategoryCellProps) {
  const uniqueCategories = [...new Set(categories.map((c) => c.category).filter(c => c && c !== ""))].sort();

  return (
    <Select
      value={value && value !== "" ? value : "__none__"}
      onValueChange={(val) => onChange(val === "__none__" ? null : val)}
    >
      <SelectTrigger className="h-8 w-[140px] text-left">
        <SelectValue placeholder="Select..." />
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
}

export function EditableSubcategoryCell({
  value,
  category,
  categories,
  onChange,
}: EditableSubcategoryCellProps) {
  const availableSubcategories = categories
    .filter((c) => c.category === category && c.subcategory && c.subcategory !== "")
    .map((c) => c.subcategory)
    .sort();

  return (
    <Select
      value={value && value !== "" ? value : "__none__"}
      onValueChange={(val) => onChange(val === "__none__" ? null : val)}
      disabled={!category}
    >
      <SelectTrigger className="h-8 w-[160px] text-left">
        <SelectValue placeholder={category ? "Select..." : "Select category first"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {availableSubcategories.map((sub) => (
          <SelectItem key={sub} value={sub}>
            {sub}
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
      .sort((a, b) => a.subcategory.localeCompare(b.subcategory)),
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
    if (subcategoryExists && currentSubcategory) {
      const catId = findCategoryId(cat, currentSubcategory, categories);
      onChange(catId);
    } else {
      // Default to "Other"
      const otherCatId = findCategoryId(cat, "Other", categories);
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
            // Use effectiveCategory (selected or inherited) to find "Other"
            const otherCatId = findCategoryId(effectiveCategory, "Other", categories);
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
          {!selectedCat && parentSubcategory && !categoryId ? (
            <span className="text-muted-foreground truncate">{parentSubcategory}</span>
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
              {cat.subcategory || "(default)"}
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

  if (!current && (parentCategory || parentSubcategory)) {
    return (
      <span className="text-xs text-muted-foreground">
        {parentCategory || ""}
        {parentSubcategory && (
          <>
            <ChevronRight className="inline h-3 w-3 mx-0.5" />
            {parentSubcategory}
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
      {current.subcategory && (
        <>
          <ChevronRight className="inline h-3 w-3 mx-0.5 text-muted-foreground" />
          {current.subcategory}
        </>
      )}
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

// Helper function to find category_id for a given category/subcategory combination
export function findCategoryId(
  category: string | null,
  subcategory: string | null,
  categories: Category[]
): number | null {
  if (!category) return null;

  // If subcategory provided, find exact match
  if (subcategory) {
    const match = categories.find(
      (c) => c.category === category && c.subcategory === subcategory
    );
    return match?.id ?? null;
  }

  // If no subcategory, find first match for this category
  const match = categories.find((c) => c.category === category);
  return match?.id ?? null;
}

// Read-only display for split category column
interface ReadOnlyCategoryCellProps {
  value: string | null;
}

export function ReadOnlyCategoryCell({ value }: ReadOnlyCategoryCellProps) {
  if (!value) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  return <span className="text-xs">{value}</span>;
}

// Read-only display for split subcategory column
interface ReadOnlySubcategoryCellProps {
  value: string | null;
}

export function ReadOnlySubcategoryCell({ value }: ReadOnlySubcategoryCellProps) {
  if (!value) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  return <span className="text-xs">{value}</span>;
}
