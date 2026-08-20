import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";
import { statusLabel } from "@/lib/format";

const STATUS_COLORS: Record<OrderStatus, string> = {
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-900",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        STATUS_COLORS[status],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
