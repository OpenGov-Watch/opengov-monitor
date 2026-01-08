import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
