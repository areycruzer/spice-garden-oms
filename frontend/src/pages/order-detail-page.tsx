import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useAddOrderItem,
  useOrder,
  useRemoveOrderItem,
  useUpdateOrderStatus,
} from "@/lib/hooks";
import { ApiError, STATUS_TRANSITIONS, canMutateItems } from "@/lib/types";
import { formatDateTime, formatINR, statusLabel } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const query = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id);
  const addItem = useAddOrderItem(id);
  const removeItem = useRemoveOrderItem(id);

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Failed to load order";
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="font-medium text-ink">{message}</p>
        <Link to="/orders" className="mt-4 inline-block text-brand hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const order = query.data!.data;
  const allowed = STATUS_TRANSITIONS[order.status];
  const mutable = canMutateItems(order.status);

  async function onStatusChange(next: string) {
    try {
      await updateStatus.mutateAsync(next as typeof order.status);
      toast.success(`Status updated to ${statusLabel(next)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  async function onAddItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addItem.mutateAsync({
        itemName: itemName.trim(),
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
      });
      setItemName("");
      setQuantity("1");
      setUnitPrice("");
      toast.success("Item added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add item");
    }
  }

  async function onRemove(itemId: string) {
    try {
      await removeItem.mutateAsync(itemId);
      toast.success("Item removed");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not remove item",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/orders" className="text-sm text-muted hover:text-ink">
            ← Orders
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Customer
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Name</dt>
            <dd className="font-medium">{order.customer.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Phone</dt>
            <dd className="font-medium">{order.customer.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="font-medium">{order.customer.email ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {allowed.length === 0 ? (
              <p className="text-sm text-muted">Terminal status — no transitions</p>
            ) : (
              allowed.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === "CANCELLED" ? "destructive" : "outline"}
                  disabled={updateStatus.isPending}
                  onClick={() => void onStatusChange(next)}
                >
                  Mark {statusLabel(next)}
                </Button>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Line items
          </h2>
          <p className="text-sm font-medium">
            {order.itemCount} items · {formatINR(order.totalAmount)}
          </p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Qty</th>
              <th className="px-5 py-3 font-medium">Unit</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">{item.itemName}</td>
                <td className="px-5 py-3">{item.quantity}</td>
                <td className="px-5 py-3">{formatINR(item.unitPrice)}</td>
                <td className="px-5 py-3">{formatINR(item.totalPrice)}</td>
                <td className="px-5 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!mutable || removeItem.isPending}
                    onClick={() => void onRemove(item.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Add item
        </h2>
        {!mutable && (
          <p className="mt-2 text-sm text-muted">
            Items can only be changed while status is Confirmed or Preparing.
          </p>
        )}
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => void onAddItem(e)}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="itemName">Item name</Label>
            <Input
              id="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              disabled={!mutable}
              required
            />
          </div>
          <div>
            <Label htmlFor="quantity">Qty</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!mutable}
              required
            />
          </div>
          <div>
            <Label htmlFor="unitPrice">Unit price (₹)</Label>
            <Input
              id="unitPrice"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              disabled={!mutable}
              required
            />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={!mutable || addItem.isPending}>
              Add item
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
