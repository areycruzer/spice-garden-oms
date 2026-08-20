import { and, eq, isNull } from "drizzle-orm";
import {
  diningTables,
  seatingAssignments,
} from "@spice-garden/database/schema";
import type { db } from "../db/index.js";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Clear active seating for an order and free the table. */
export async function clearSeatingForOrder(
  tx: DbTx,
  orderId: string,
  clearedAt: Date = new Date(),
): Promise<void> {
  const [active] = await tx
    .select()
    .from(seatingAssignments)
    .where(
      and(
        eq(seatingAssignments.orderId, orderId),
        isNull(seatingAssignments.clearedAt),
      ),
    );

  if (!active) return;

  await tx
    .update(seatingAssignments)
    .set({ clearedAt })
    .where(eq(seatingAssignments.id, active.id));

  await tx
    .update(diningTables)
    .set({ status: "FREE" })
    .where(eq(diningTables.id, active.tableId));
}
