import { useState } from "react";
import { toast } from "sonner";
import {
  useAssignSeat,
  useClearSeat,
  useFloor,
  useSuggestSeat,
} from "@/lib/hooks";
import { ApiError, type UnseatedOrder } from "@/lib/types";
import { statusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function FloorPage() {
  const floorQuery = useFloor();
  const suggest = useSuggestSeat();
  const assign = useAssignSeat();
  const clear = useClearSeat();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [suggestedTableId, setSuggestedTableId] = useState<string | null>(null);
  const [suggestReason, setSuggestReason] = useState<string | null>(null);

  if (floorQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (floorQuery.isError) {
    const message =
      floorQuery.error instanceof ApiError
        ? floorQuery.error.message
        : "Failed to load floor";
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="font-medium text-ink">{message}</p>
      </div>
    );
  }

  const floor = floorQuery.data!.data;
  const selected: UnseatedOrder | undefined = floor.unseatedOrders.find(
    (o) => o.id === selectedOrderId,
  );

  async function onSuggest(orderId: string) {
    setSelectedOrderId(orderId);
    try {
      const res = await suggest.mutateAsync(orderId);
      setSuggestedTableId(res.data.table?.id ?? null);
      setSuggestReason(res.data.reason);
      if (!res.data.table) {
        toast.message(res.data.reason);
      } else {
        toast.success(`Suggested ${res.data.table.label}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Suggest failed");
    }
  }

  async function onAssign(tableId: string, source: "AI" | "HOST") {
    if (!selectedOrderId) {
      toast.message("Select an unseated order first");
      return;
    }
    try {
      await assign.mutateAsync({
        orderId: selectedOrderId,
        tableId,
        source,
      });
      toast.success(source === "AI" ? "Accepted AI suggestion" : "Host override seated");
      setSelectedOrderId(null);
      setSuggestedTableId(null);
      setSuggestReason(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Assign failed");
    }
  }

  async function onClear(orderId: string) {
    try {
      await clear.mutateAsync(orderId);
      toast.success("Table cleared");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Clear failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          Floor Ops
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Live floor
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          AI suggests the best open table. Hosts keep one-tap override — governed
          by your team.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-label="Dining floor">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {floor.tables.map((table) => {
              const isSuggested = table.id === suggestedTableId;
              const occupied = table.status !== "FREE";
              const canSeat =
                !occupied && Boolean(selectedOrderId) && !assign.isPending;
              const tileClass = cn(
                "relative flex min-h-[7.5rem] flex-col items-start justify-between rounded-lg border p-3 text-left transition",
                occupied
                  ? "border-brand/30 bg-brand-muted/60"
                  : "border-border bg-card",
                isSuggested &&
                  "ring-2 ring-brand ring-offset-2 ring-offset-surface",
                canSeat &&
                  "cursor-pointer hover:border-brand hover:bg-brand-muted/40",
              );

              const header = (
                <div className="flex w-full items-baseline justify-between">
                  <span className="font-display text-xl font-semibold">
                    {table.label}
                  </span>
                  <span className="text-xs text-muted">
                    {table.capacity} seats
                  </span>
                </div>
              );

              if (occupied && table.assignment) {
                return (
                  <div key={table.id} className={tileClass}>
                    {header}
                    <div className="mt-2 space-y-0.5 text-xs">
                      <p className="font-medium text-ink">
                        {table.assignment.orderNumber}
                      </p>
                      <p className="text-muted">
                        {table.assignment.customerName}
                      </p>
                      <p className="text-muted">
                        party {table.assignment.partySize} ·{" "}
                        {table.assignment.source}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7 px-2 text-xs"
                        disabled={clear.isPending}
                        onClick={() => void onClear(table.assignment!.orderId)}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!canSeat}
                  onClick={() => {
                    const source =
                      table.id === suggestedTableId ? "AI" : "HOST";
                    void onAssign(table.id, source);
                  }}
                  className={tileClass}
                >
                  {header}
                  <p className="mt-auto text-xs text-muted">
                    {selectedOrderId
                      ? isSuggested
                        ? "Accept suggestion"
                        : "Override seat here"
                      : "Free"}
                  </p>
                </button>
              );
            })}
          </div>
          {suggestReason && (
            <p className="mt-3 text-sm text-muted">{suggestReason}</p>
          )}
        </section>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Unseated queue
          </h2>
          {floor.unseatedOrders.length === 0 ? (
            <p className="text-sm text-muted">No open orders waiting for a table.</p>
          ) : (
            <ul className="space-y-2">
              {floor.unseatedOrders.map((order) => {
                const active = order.id === selectedOrderId;
                return (
                  <li
                    key={order.id}
                    className={cn(
                      "rounded-lg border border-border bg-card p-3",
                      active && "border-brand bg-brand-muted/50",
                    )}
                  >
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted">
                      {order.customerName} · party {order.partySize} ·{" "}
                      {statusLabel(order.status)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={active ? "default" : "outline"}
                        disabled={suggest.isPending}
                        onClick={() => void onSuggest(order.id)}
                      >
                        Suggest
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {selected && (
            <p className="text-xs text-muted">
              Selected {selected.orderNumber}. Tap a free table to seat (AI if
              highlighted, otherwise host override).
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
