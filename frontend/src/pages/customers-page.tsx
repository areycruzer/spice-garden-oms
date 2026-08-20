import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCustomers } from "@/lib/hooks";
import { ApiError } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const query = useCustomers({ search, page, size: 10 });

  useEffect(() => {
    if (query.isError && query.error instanceof ApiError) {
      toast.error(query.error.message);
    }
  }, [query.isError, query.error]);

  const data = query.data?.data ?? [];
  const pagination = query.data?.meta?.pagination;
  const showingFrom =
    pagination && pagination.total > 0
      ? (pagination.page - 1) * pagination.size + 1
      : 0;
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.size, pagination.total)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Customers
        </h1>
        <p className="mt-1 text-muted">
          Guests linked to Spice Garden kitchen orders
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
          setPage(1);
        }}
      >
        <Input
          placeholder="Search by name, email, or phone"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {query.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="px-4 py-16 text-center">
            <p className="font-medium text-ink">Could not load customers</p>
            <p className="mt-1 text-sm text-muted">
              {query.error instanceof ApiError
                ? query.error.message
                : "Check that the API is running."}
            </p>
          </div>
        ) : data.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-medium text-ink">No customers found</p>
            <p className="mt-1 text-sm text-muted">
              Try adjusting search or create an order with a new guest.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-brand-muted/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-brand-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Showing {showingFrom}–{showingTo} of {pagination.total}
          </p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted">
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.totalPages || page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
