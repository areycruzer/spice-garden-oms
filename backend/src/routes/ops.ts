import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import {
  customers,
  diningTables,
  orders,
  seatingAssignments,
} from "@spice-garden/database/schema";
import { db } from "../db/index.js";
import { clearSeatingForOrder } from "../lib/floor.js";
import { notFound, validationFailed } from "../lib/errors.js";
import { okData } from "../lib/response.js";
import { zodErrorHook } from "../lib/zod-hook.js";

const suggestSchema = z.object({
  orderId: z.string().uuid(),
});

const assignSchema = z.object({
  orderId: z.string().uuid(),
  tableId: z.string().uuid(),
  source: z.enum(["AI", "HOST"]),
});

const clearSchema = z.object({
  orderId: z.string().uuid(),
});

export const opsRouter = new Hono();

const OPEN_STATUSES = ["CONFIRMED", "PREPARING", "READY"] as const;

function suggestTable(
  tables: { id: string; label: string; capacity: number; status: string }[],
  partySize: number,
) {
  const free = tables
    .filter((t) => t.status === "FREE" && t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity || a.label.localeCompare(b.label));

  return free[0] ?? null;
}

async function loadFloor() {
  const tables = await db
    .select()
    .from(diningTables)
    .orderBy(asc(diningTables.label));

  const activeAssignments = await db
    .select({
      assignment: seatingAssignments,
      order: orders,
      customer: customers,
      table: diningTables,
    })
    .from(seatingAssignments)
    .innerJoin(orders, eq(seatingAssignments.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(diningTables, eq(seatingAssignments.tableId, diningTables.id))
    .where(isNull(seatingAssignments.clearedAt));

  const seatedOrderIds = activeAssignments.map((a) => a.order.id);

  const unseatedConditions = [
    inArray(orders.status, [...OPEN_STATUSES]),
  ];
  if (seatedOrderIds.length > 0) {
    unseatedConditions.push(notInArray(orders.id, seatedOrderIds));
  }

  const unseatedOrders = await db
    .select({
      order: orders,
      customer: customers,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...unseatedConditions))
    .orderBy(asc(orders.createdAt));

  return {
    tables: tables.map((t) => {
      const seated = activeAssignments.find((a) => a.table.id === t.id);
      return {
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        status: t.status,
        assignment: seated
          ? {
              id: seated.assignment.id,
              orderId: seated.order.id,
              orderNumber: seated.order.orderNumber,
              partySize: seated.assignment.partySize,
              source: seated.assignment.source,
              customerName: seated.customer.name,
              orderStatus: seated.order.status,
              createdAt: seated.assignment.createdAt.toISOString(),
            }
          : null,
      };
    }),
    unseatedOrders: unseatedOrders.map(({ order, customer }) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      partySize: order.partySize,
      itemCount: order.itemCount,
      customerName: customer.name,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

opsRouter.get("/floor", async (c) => {
  const floor = await loadFloor();
  return c.json(okData(floor));
});

opsRouter.post(
  "/floor/suggest",
  zValidator("json", suggestSchema, zodErrorHook),
  async (c) => {
    const { orderId } = c.req.valid("json");

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      throw notFound(`Order ${orderId} not found`);
    }

    if (!OPEN_STATUSES.includes(order.status as (typeof OPEN_STATUSES)[number])) {
      throw validationFailed(
        `Cannot suggest seating for status ${order.status}`,
      );
    }

    const [active] = await db
      .select()
      .from(seatingAssignments)
      .where(
        and(
          eq(seatingAssignments.orderId, orderId),
          isNull(seatingAssignments.clearedAt),
        ),
      );
    if (active) {
      throw validationFailed("Order is already seated");
    }

    const tables = await db.select().from(diningTables);
    const suggestion = suggestTable(tables, order.partySize);

    if (!suggestion) {
      return c.json(
        okData({
          orderId,
          partySize: order.partySize,
          table: null,
          reason: "No free table with enough capacity",
        }),
      );
    }

    return c.json(
      okData({
        orderId,
        partySize: order.partySize,
        table: {
          id: suggestion.id,
          label: suggestion.label,
          capacity: suggestion.capacity,
        },
        reason: `Best fit: ${suggestion.label} (cap ${suggestion.capacity}) for party of ${order.partySize}`,
      }),
    );
  },
);

opsRouter.post(
  "/floor/assign",
  zValidator("json", assignSchema, zodErrorHook),
  async (c) => {
    const body = c.req.valid("json");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, body.orderId));
      if (!order) {
        throw notFound(`Order ${body.orderId} not found`);
      }

      if (
        !OPEN_STATUSES.includes(order.status as (typeof OPEN_STATUSES)[number])
      ) {
        throw validationFailed(
          `Cannot seat order in status ${order.status}`,
        );
      }

      const [existingSeat] = await tx
        .select()
        .from(seatingAssignments)
        .where(
          and(
            eq(seatingAssignments.orderId, body.orderId),
            isNull(seatingAssignments.clearedAt),
          ),
        );
      if (existingSeat) {
        throw validationFailed("Order is already seated");
      }

      const [table] = await tx
        .select()
        .from(diningTables)
        .where(eq(diningTables.id, body.tableId));
      if (!table) {
        throw notFound(`Table ${body.tableId} not found`);
      }

      if (table.status !== "FREE") {
        throw validationFailed(`Table ${table.label} is not free`);
      }

      if (table.capacity < order.partySize) {
        throw validationFailed(
          `Table ${table.label} capacity ${table.capacity} < party ${order.partySize}`,
        );
      }

      await tx.insert(seatingAssignments).values({
        tableId: table.id,
        orderId: order.id,
        partySize: order.partySize,
        source: body.source,
      });

      await tx
        .update(diningTables)
        .set({ status: "OCCUPIED" })
        .where(eq(diningTables.id, table.id));
    });

    const floor = await loadFloor();
    return c.json(okData(floor));
  },
);

opsRouter.post(
  "/floor/clear",
  zValidator("json", clearSchema, zodErrorHook),
  async (c) => {
    const { orderId } = c.req.valid("json");

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      throw notFound(`Order ${orderId} not found`);
    }

    await db.transaction(async (tx) => {
      await clearSeatingForOrder(tx, orderId);
    });

    const floor = await loadFloor();
    return c.json(okData(floor));
  },
);

export { suggestTable };
