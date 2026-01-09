import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { createReferendaColumns } from "@/components/tables/referenda-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { useAuth } from "@/contexts/auth-context";
import type { Referendum, Category } from "@/lib/db/types";

export default function ReferendaPage() {
  const [data, setData] = useState<Referendum[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    Promise.all([api.referenda.getAll(), api.categories.getAll()])
      .then(([referendaRes, categoriesRes]) => {
        setData(referendaRes as Referendum[]);
        setCategories(categoriesRes as Category[]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (id: number, updates: Partial<Referendum>) => {
    try {
      await api.referenda.update(id, updates);
      // Update local state
      setData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    } catch (err) {
      console.error("Failed to update referendum:", err);
    }
  };

  const columns = useMemo(
    () =>
      createReferendaColumns({
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
        <h1 className="text-3xl font-bold tracking-tight">Referenda</h1>
        <p className="text-muted-foreground">
          Browse and filter Polkadot governance referenda
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={columns} data={data} tableName="referenda" />
      )}
    </div>
  );
}
