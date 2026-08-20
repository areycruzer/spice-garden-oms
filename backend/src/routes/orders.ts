import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  customers,
  orderItems,
  orderStatusEvents,
  orders,
} from "@spice-garden/database/schema";
import { db, sql as pgSql } from "../db/index.js";
import {
  alreadyExists,
  invalidFilter,
  invalidStatusTransition,
  notFound,
  validationFailed,
} from "../lib/errors.js";
import { clearSeatingForOrder } from "../lib/floor.js";
import { mapOrderDetails } from "../lib/mappers.js";
import { nextOrderNumber } from "../lib/order-number.js";
import { recomputeOrderTotals } from "../lib/order-totals.js";
import { buildPaginationMeta, parsePagination } from "../lib/pagination.js";
import { okData, okPaginated } from "../lib/response.js";
import {
  canMutateItems,
  canTransition,
  isOrderStatus,
  type OrderStatus,
} from "../lib/status.js";
import { zodErrorHook } from "../lib/zod-hook.js";

const orderItemInputSchema = z.object({
  itemName: z.string().min(1, "itemName is required"),
  quantity: z.number().int().positive("quantity must be > 0"),
  unitPrice: z.number().nonnegative("unitPrice must be >= 0"),
});

const createOrderSchema = z.object({
  customer: z.object({
    id: z.string().uuid().nullable(),
    name: z.string().min(1, "name is required"),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(1, "phone is required"),
  }),
  partySize: z.number().int().min(1).max(20).optional(),
  items: z
    .array(orderItemInputSchema)
    .min(1, "order must contain at least one item"),
});
const statusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]),
});

const addItemSchema = orderItemInputSchema;

export const ordersRouter = new Hono();

async function loadOrderDetails(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId));

  if (!customer) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.createdAt);

  const events = await db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, orderId))
    .orderBy(orderStatusEvents.changedAt);

  return mapOrderDetails(order, customer, items, events);
}

ordersRouter.get("/", async (c) => {
  const { search, status, customerId, page, size } = c.req.query();
  const pagination = parsePagination(page, size);

  if (status !== undefined && status !== "") {
    if (!isOrderStatus(status)) {
      throw invalidFilter(`Invalid status filter: ${status}`);
    }
  }

  if (customerId) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));
    if (!customer) {
      throw notFound(`Customer ${customerId} not found`);
    }
  }

  const conditions = [];

  if (status && isOrderStatus(status)) {
    conditions.push(eq(orders.status, status));
  }

  if (customerId) {
    conditions.push(eq(orders.customerId, customerId));
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(ilike(orders.orderNumber, term), ilike(customers.name, term)),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where);

  const rows = await db
    .select({
      order: orders,
      customer: customers,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pagination.size)
    .offset(pagination.offset);

  const orderIds = rows.map((r) => r.order.id);
  const allItems =
    orderIds.length === 0
      ? []
      : await db
          .select()
          .from(orderItems)
          .where(
            sql`${orderItems.orderId} IN (${sql.join(
              orderIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .orderBy(orderItems.createdAt);

  const allEvents =
    orderIds.length === 0
      ? []
      : await db
          .select()
          .from(orderStatusEvents)
          .where(
            sql`${orderStatusEvents.orderId} IN (${sql.join(
              orderIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .orderBy(orderStatusEvents.changedAt);

  const itemsByOrder = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const eventsByOrder = new Map<string, typeof allEvents>();
  for (const event of allEvents) {
    const list = eventsByOrder.get(event.orderId) ?? [];
    list.push(event);
    eventsByOrder.set(event.orderId, list);
  }

  const data = rows.map(({ order, customer }) =>
    mapOrderDetails(
      order,
      customer,
      itemsByOrder.get(order.id) ?? [],
      eventsByOrder.get(order.id) ?? [],
    ),
  );

  return c.json(
    okPaginated(
      data,
      buildPaginationMeta(pagination.page, pagination.size, totalRow?.value ?? 0),
    ),
  );
});

ordersRouter.get("/:order_id", async (c) => {
  const orderId = c.req.param("order_id");
  const details = await loadOrderDetails(orderId);
  if (!details) {
    throw notFound(`Order ${orderId} not found`);
  }
  return c.json(okData(details));
});

ordersRouter.post(
  "/",
  zValidator("json", createOrderSchema, zodErrorHook),
  async (c) => {
    const body = c.req.valid("json");

    if (!body.items.length) {
      throw validationFailed("order must contain at least one item");
    }

    try {
      const orderId = await db.transaction(async (tx) => {
        let customerId: string;

        if (body.customer.id) {
          const [existing] = await tx
            .select()
            .from(customers)
            .where(eq(customers.id, body.customer.id));
          if (!existing) {
            throw notFound(`Customer ${body.customer.id} not found`);
          }
          customerId = existing.id;
        } else {
          try {
            const [created] = await tx
              .insert(customers)
              .values({
                name: body.customer.name,
                email:
                  body.customer.email === undefined
                    ? null
                    : body.customer.email,
                phone: body.customer.phone,
              })
              .returning();
            customerId = created!.id;
          } catch (err) {
            if (isUniqueViolation(err)) {
              throw alreadyExists(
                "A customer with this phone already exists",
              );
            }
            throw err;
          }
        }

        const orderNumber = await nextOrderNumber(pgSql);

        const now = new Date();
        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            customerId,
            status: "CONFIRMED",
            partySize: body.partySize ?? 2,
            totalAmount: "0",
            itemCount: 0,
            statusChangedAt: now,
          })
          .returning();

        await tx.insert(orderStatusEvents).values({
          orderId: order!.id,
          fromStatus: null,
          toStatus: "CONFIRMED",
          changedAt: now,
        });

        await tx.insert(orderItems).values(
          body.items.map((item) => {
            const totalPrice = (item.quantity * item.unitPrice).toFixed(2);
            return {
              orderId: order!.id,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice.toFixed(2),
              totalPrice,
            };
          }),
        );

        await recomputeOrderTotals(tx, order!.id);
        return order!.id;
      });

      const details = await loadOrderDetails(orderId);
      return c.json(okData(details!), 201);
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof (err as { code: unknown }).code === "string" &&
        ["RESOURCE_NOT_FOUND", "RESOURCE_ALREADY_EXISTS", "VALIDATION_FAILED"].includes(
          (err as { code: string }).code,
        )
      ) {
        throw err;
      }
      throw err;
    }
  },
);

ordersRouter.patch(
  "/:order_id/status",
  zValidator("json", statusSchema, zodErrorHook),
  async (c) => {
    const orderId = c.req.param("order_id");
    const { status: nextStatus } = c.req.valid("json");

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      throw notFound(`Order ${orderId} not found`);
    }

    const current = order.status as OrderStatus;
    if (!canTransition(current, nextStatus)) {
      throw invalidStatusTransition(
        `Cannot transition from ${current} to ${nextStatus}`,
      );
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: nextStatus,
          statusChangedAt: now,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId));

      await tx.insert(orderStatusEvents).values({
        orderId,
        fromStatus: current,
        toStatus: nextStatus,
        changedAt: now,
      });

      if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") {
        await clearSeatingForOrder(tx, orderId, now);
      }
    });

    const details = await loadOrderDetails(orderId);
    return c.json(okData(details!));
  },
);

ordersRouter.post(
  "/:order_id/items",
  zValidator("json", addItemSchema, zodErrorHook),
  async (c) => {
    const orderId = c.req.param("order_id");
    const body = c.req.valid("json");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId));

      if (!order) {
        throw notFound(`Order ${orderId} not found`);
      }

      if (!canMutateItems(order.status as OrderStatus)) {
        throw validationFailed(
          `Items can only be added when status is CONFIRMED or PREPARING (current: ${order.status})`,
        );
      }

      const totalPrice = (body.quantity * body.unitPrice).toFixed(2);
      await tx.insert(orderItems).values({
        orderId,
        itemName: body.itemName,
        quantity: body.quantity,
        unitPrice: body.unitPrice.toFixed(2),
        totalPrice,
      });

      await recomputeOrderTotals(tx, orderId);
    });

    const details = await loadOrderDetails(orderId);
    return c.json(okData(details!), 201);
  },
);

ordersRouter.delete("/:order_id/items/:item_id", async (c) => {
  const orderId = c.req.param("order_id");
  const itemId = c.req.param("item_id");

  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!order) {
      throw notFound(`Order ${orderId} not found`);
    }

    if (!canMutateItems(order.status as OrderStatus)) {
      throw validationFailed(
        `Items can only be removed when status is CONFIRMED or PREPARING (current: ${order.status})`,
      );
    }

    const [item] = await tx
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));

    if (!item) {
      throw notFound(`Order item ${itemId} not found`);
    }

    await tx.delete(orderItems).where(eq(orderItems.id, itemId));
    await recomputeOrderTotals(tx, orderId);
  });

  const details = await loadOrderDetails(orderId);
  return c.json(okData(details!));
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
