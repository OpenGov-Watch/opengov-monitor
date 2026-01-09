import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { createChildBountiesColumns } from "@/components/tables/child-bounties-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { useAuth } from "@/contexts/auth-context";
import type { ChildBounty, Category } from "@/lib/db/types";

export default function ChildBountiesPage() {
  const [data, setData] = useState<ChildBounty[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    Promise.all([api.childBounties.getAll(), api.categories.getAll()])
      .then(([childBountiesRes, categoriesRes]) => {
        setData(childBountiesRes as ChildBounty[]);
        setCategories(categoriesRes as Category[]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (
    identifier: string,
    updates: Partial<ChildBounty>
  ) => {
    try {
      await api.childBounties.update(identifier, updates);
      // Update local state
      setData((prev) =>
        prev.map((item) =>
          item.identifier === identifier ? { ...item, ...updates } : item
        )
      );
    } catch (err) {
      console.error("Failed to update child bounty:", err);
    }
  };

  const columns = useMemo(
    () =>
      createChildBountiesColumns({
        categories,
        onUpdate: handleUpdate,
        isAuthenticated,
      }),
    [categories, isAuthenticated]
  );

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <h2 className="font-semibold text-destructive">Error</h2>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Child Bounties</h1>
        <p className="text-muted-foreground">
          Browse and filter child bounty claims
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          tableName="child-bounties"
          defaultSorting={[{ id: "identifier", desc: true }]}
        />
      )}
    </div>
  );
}
