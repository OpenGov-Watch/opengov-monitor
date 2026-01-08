import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
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
  const uniqueCategories = [...new Set(categories.map((c) => c.category))].sort();

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(val) => onChange(val === "__none__" ? null : val)}
    >
      <SelectTrigger className="h-8 w-[140px]">
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
    .filter((c) => c.category === category)
    .map((c) => c.subcategory)
    .sort();

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(val) => onChange(val === "__none__" ? null : val)}
      disabled={!category}
    >
      <SelectTrigger className="h-8 w-[160px]">
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
}

export function CategorySelector({
  categoryId,
  categories,
  onChange,
}: CategorySelectorProps) {
  const current = categories.find((c) => c.id === categoryId);
  const [selectedCat, setSelectedCat] = useState<string | null>(
    current?.category || null
  );

  // Sync selected category when categoryId prop changes
  useEffect(() => {
    const cat = categories.find((c) => c.id === categoryId);
    setSelectedCat(cat?.category || null);
  }, [categoryId, categories]);

  const uniqueCategories = [...new Set(categories.map((c) => c.category))].sort();
  const availableSubcategories = categories
    .filter((c) => c.category === selectedCat)
    .sort((a, b) => a.subcategory.localeCompare(b.subcategory));

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCat(cat);
    if (!cat) {
      onChange(null);
      return;
    }
    // Auto-select if only one subcategory exists
    const subs = categories.filter((c) => c.category === cat);
    if (subs.length === 1) {
      onChange(subs[0].id);
    } else {
      onChange(null); // Clear until subcategory selected
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
          <SelectValue placeholder="Category" />
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
        onValueChange={(val) =>
          onChange(val === "__none__" ? null : parseInt(val))
        }
        disabled={!selectedCat}
      >
        <SelectTrigger
          className={cn("h-8 w-[140px] text-xs", !selectedCat && "opacity-50")}
        >
          <SelectValue placeholder="Subcategory" />
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
