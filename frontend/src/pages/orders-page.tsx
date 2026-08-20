import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import { useOrders } from "@/lib/hooks";
import type { OrderDetails, OrderStatus } from "@/lib/types";
import { ApiError } from "@/lib/types";
import { formatDateTime, formatINR, statusLabel } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABS: { key: "" | OrderStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const columnHelper = createColumnHelper<OrderDetails>();

export function OrdersPage() {
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const query = useOrders({
    status,
    search,
    page,
    size: 10,
  });

  useEffect(() => {
    if (query.isError && query.error instanceof ApiError) {
      toast.error(query.error.message);
    }
  }, [query.isError, query.error]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("orderNumber", {
        header: "Order",
        cell: (info) => (
          <Link
            to={`/orders/${info.row.original.id}`}
            className="font-medium text-brand hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.customer.name, {
        id: "customer",
        header: "Customer",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("itemCount", {
        header: "Items",
      }),
      columnHelper.accessor("totalAmount", {
        header: "Total",
        cell: (info) => formatINR(info.getValue()),
      }),
      columnHelper.accessor("createdAt", {
        header: "Placed",
        cell: (info) => formatDateTime(info.getValue()),
      }),
    ],
    [],
  );

  const data = query.data?.data ?? [];
  const pagination = query.data?.meta?.pagination;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const showingFrom =
    pagination && pagination.total > 0
      ? (pagination.page - 1) * pagination.size + 1
      : 0;
  const showingTo = pagination
    ? Math.min(pagination.page * pagination.size, pagination.total)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Orders
          </h1>
          <p className="mt-1 text-muted">
            Track and manage every order across the kitchen
          </p>
        </div>
        <Link
          to="/orders/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Create Order
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === tab.key
                ? "bg-brand text-white"
                : "bg-card text-muted hover:bg-brand-muted hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
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
          placeholder="Search by order number or customer name"
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
            <p className="font-medium text-ink">Could not load orders</p>
            <p className="mt-1 text-sm text-muted">
              {query.error instanceof ApiError
                ? query.error.message
                : "Check that the API is running."}
            </p>
          </div>
        ) : data.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-medium text-ink">No orders found</p>
            <p className="mt-1 text-sm text-muted">
              {status
                ? `Nothing in ${statusLabel(status)} right now.`
                : "Try adjusting search or create a new order."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-brand-muted/50 text-xs uppercase tracking-wide text-muted">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 font-medium">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-brand-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
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
              disabled={
                !pagination.totalPages || page >= pagination.totalPages
              }
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
