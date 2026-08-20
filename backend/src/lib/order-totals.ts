import { eq, sql } from "drizzle-orm";
import { orderItems, orders } from "@spice-garden/database/schema";
import type { Tx } from "../db/index.js";

export async function recomputeOrderTotals(tx: Tx, orderId: string) {
  const [totals] = await tx
    .select({
      itemCount: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      totalAmount: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)::numeric(10,2)`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const [updated] = await tx
    .update(orders)
    .set({
      itemCount: totals?.itemCount ?? 0,
      totalAmount: totals?.totalAmount ?? "0",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return updated!;
}
