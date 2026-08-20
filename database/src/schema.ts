import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  smallint,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

export const tableStatusEnum = pgEnum("table_status", [
  "FREE",
  "OCCUPIED",
  "TURNING",
]);

export const seatingSourceEnum = pgEnum("seating_source", ["AI", "HOST"]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("customers_phone_unique").on(table.phone)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("CONFIRMED"),
    partySize: smallint("party_size").notNull().default(2),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    itemCount: integer("item_count").notNull().default(0),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique").on(table.orderNumber),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_order_number_idx").on(table.orderNumber),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check("order_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("order_status_events_order_id_idx").on(table.orderId)],
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    capacity: smallint("capacity").notNull(),
    status: tableStatusEnum("status").notNull().default("FREE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("dining_tables_label_unique").on(table.label)],
);

export const seatingAssignments = pgTable(
  "seating_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    partySize: smallint("party_size").notNull(),
    source: seatingSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
  },
  (table) => [
    index("seating_assignments_table_id_idx").on(table.tableId),
    index("seating_assignments_order_id_idx").on(table.orderId),
  ],
);

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  statusEvents: many(orderStatusEvents),
  seatingAssignments: many(seatingAssignments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const orderStatusEventsRelations = relations(
  orderStatusEvents,
  ({ one }) => ({
    order: one(orders, {
      fields: [orderStatusEvents.orderId],
      references: [orders.id],
    }),
  }),
);

export const diningTablesRelations = relations(diningTables, ({ many }) => ({
  seatingAssignments: many(seatingAssignments),
}));

export const seatingAssignmentsRelations = relations(
  seatingAssignments,
  ({ one }) => ({
    table: one(diningTables, {
      fields: [seatingAssignments.tableId],
      references: [diningTables.id],
    }),
    order: one(orders, {
      fields: [seatingAssignments.orderId],
      references: [orders.id],
    }),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect;
export type DiningTable = typeof diningTables.$inferSelect;
export type SeatingAssignment = typeof seatingAssignments.$inferSelect;
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type TableStatus = (typeof tableStatusEnum.enumValues)[number];
export type SeatingSource = (typeof seatingSourceEnum.enumValues)[number];
