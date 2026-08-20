import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import {
  customers,
  diningTables,
  orderItems,
  orderStatusEvents,
  orders,
  seatingAssignments,
} from "./schema.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://spice:spice@localhost:5432/spice_garden";

const MENU = [
  { itemName: "Paneer Butter Masala", unitPrice: "320.00" },
  { itemName: "Chicken Biryani", unitPrice: "380.00" },
  { itemName: "Masala Dosa", unitPrice: "180.00" },
  { itemName: "Butter Naan", unitPrice: "60.00" },
  { itemName: "Gulab Jamun", unitPrice: "120.00" },
  { itemName: "Mango Lassi", unitPrice: "140.00" },
  { itemName: "Dal Makhani", unitPrice: "260.00" },
  { itemName: "Tandoori Chicken", unitPrice: "420.00" },
  { itemName: "Veg Thali", unitPrice: "350.00" },
  { itemName: "Filter Coffee", unitPrice: "80.00" },
] as const;

const CUSTOMER_SEED = [
  { name: "Aarav Sharma", email: "aarav.sharma@email.com", phone: "+919876543210" },
  { name: "Priya Nair", email: "priya.nair@email.com", phone: "+919876543211" },
  { name: "Rohan Mehta", email: "rohan.mehta@email.com", phone: "+919876543212" },
  { name: "Ananya Iyer", email: "ananya.iyer@email.com", phone: "+919876543213" },
  { name: "Vikram Reddy", email: "vikram.reddy@email.com", phone: "+919876543214" },
  { name: "Sneha Pillai", email: "sneha.pillai@email.com", phone: "+919876543215" },
  { name: "Karan Gupta", email: "karan.gupta@email.com", phone: "+919876543216" },
  { name: "Meera Krishnan", email: "meera.krishnan@email.com", phone: "+919876543217" },
] as const;

const TABLE_SEED = [
  { label: "T1", capacity: 2 },
  { label: "T2", capacity: 2 },
  { label: "T3", capacity: 4 },
  { label: "T4", capacity: 4 },
  { label: "T5", capacity: 4 },
  { label: "T6", capacity: 6 },
  { label: "T7", capacity: 6 },
  { label: "T8", capacity: 2 },
  { label: "T9", capacity: 4 },
  { label: "T10", capacity: 8 },
  { label: "T11", capacity: 2 },
  { label: "T12", capacity: 4 },
] as const;

type Status =
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

function daysAgo(days: number, hour = 12): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function line(
  menuIndex: number,
  quantity: number,
): { itemName: string; quantity: number; unitPrice: string; totalPrice: string } {
  const item = MENU[menuIndex]!;
  const total = (Number(item.unitPrice) * quantity).toFixed(2);
  return {
    itemName: item.itemName,
    quantity,
    unitPrice: item.unitPrice,
    totalPrice: total,
  };
}

async function main() {
  const client = postgres(databaseUrl, {
    max: 1,
    ssl:
      databaseUrl.includes("render.com") || databaseUrl.includes("sslmode=require")
        ? "require"
        : undefined,
  });
  const db = drizzle(client);

  console.log("Seeding Spice Garden database...");

  await db.delete(seatingAssignments);
  await db.delete(orderStatusEvents);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(diningTables);
  await client`ALTER SEQUENCE order_number_seq RESTART WITH 1001`;

  const insertedCustomers = await db
    .insert(customers)
    .values([...CUSTOMER_SEED])
    .returning();

  const byName = Object.fromEntries(
    insertedCustomers.map((c) => [c.name, c]),
  ) as Record<string, (typeof insertedCustomers)[number]>;

  const insertedTables = await db
    .insert(diningTables)
    .values([...TABLE_SEED])
    .returning();

  const tableByLabel = Object.fromEntries(
    insertedTables.map((t) => [t.label, t]),
  ) as Record<string, (typeof insertedTables)[number]>;

  type OrderSeed = {
    customerName: string;
    status: Status;
    partySize: number;
    createdAt: Date;
    items: ReturnType<typeof line>[];
    seatAt?: string;
    seatSource?: "AI" | "HOST";
  };

  const orderSeeds: OrderSeed[] = [
    {
      customerName: "Aarav Sharma",
      status: "CONFIRMED",
      partySize: 4,
      createdAt: daysAgo(0, 10),
      items: [line(0, 2), line(3, 4), line(5, 2)],
    },
    {
      customerName: "Priya Nair",
      status: "CONFIRMED",
      partySize: 2,
      createdAt: daysAgo(0, 11),
      items: [line(2, 2), line(5, 1)],
    },
    {
      customerName: "Rohan Mehta",
      status: "CONFIRMED",
      partySize: 3,
      createdAt: daysAgo(1, 9),
      items: [line(1, 1), line(3, 2), line(4, 2)],
    },
    {
      customerName: "Ananya Iyer",
      status: "PREPARING",
      partySize: 4,
      createdAt: daysAgo(0, 8),
      items: [line(7, 1), line(3, 3), line(5, 2)],
      seatAt: "T3",
      seatSource: "AI",
    },
    {
      customerName: "Vikram Reddy",
      status: "PREPARING",
      partySize: 2,
      createdAt: daysAgo(1, 14),
      items: [line(8, 2), line(9, 2)],
      seatAt: "T1",
      seatSource: "HOST",
    },
    {
      customerName: "Sneha Pillai",
      status: "PREPARING",
      partySize: 3,
      createdAt: daysAgo(2, 13),
      items: [line(0, 1), line(6, 1), line(3, 2)],
    },
    {
      customerName: "Karan Gupta",
      status: "READY",
      partySize: 2,
      createdAt: daysAgo(0, 7),
      items: [line(1, 2), line(5, 2)],
      seatAt: "T2",
      seatSource: "AI",
    },
    {
      customerName: "Meera Krishnan",
      status: "READY",
      partySize: 4,
      createdAt: daysAgo(1, 16),
      items: [line(2, 3), line(4, 2), line(9, 1)],
    },
    {
      customerName: "Aarav Sharma",
      status: "READY",
      partySize: 6,
      createdAt: daysAgo(2, 12),
      items: [line(7, 2), line(3, 4)],
    },
    {
      customerName: "Priya Nair",
      status: "COMPLETED",
      partySize: 2,
      createdAt: daysAgo(3, 19),
      items: [line(0, 1), line(1, 1), line(3, 2), line(4, 1)],
    },
    {
      customerName: "Rohan Mehta",
      status: "COMPLETED",
      partySize: 3,
      createdAt: daysAgo(4, 18),
      items: [line(8, 1), line(5, 2)],
    },
    {
      customerName: "Ananya Iyer",
      status: "COMPLETED",
      partySize: 2,
      createdAt: daysAgo(5, 20),
      items: [line(2, 2), line(3, 2), line(9, 2)],
    },
    {
      customerName: "Vikram Reddy",
      status: "COMPLETED",
      partySize: 4,
      createdAt: daysAgo(6, 13),
      items: [line(6, 2), line(3, 4), line(4, 2)],
    },
    {
      customerName: "Sneha Pillai",
      status: "CANCELLED",
      partySize: 2,
      createdAt: daysAgo(2, 10),
      items: [line(1, 1), line(5, 1)],
    },
    {
      customerName: "Karan Gupta",
      status: "CANCELLED",
      partySize: 4,
      createdAt: daysAgo(3, 11),
      items: [line(0, 2), line(3, 2)],
    },
    {
      customerName: "Meera Krishnan",
      status: "CANCELLED",
      partySize: 2,
      createdAt: daysAgo(7, 15),
      items: [line(7, 1), line(9, 1)],
    },
  ];

  for (const seed of orderSeeds) {
    const customer = byName[seed.customerName];
    if (!customer) {
      throw new Error(`Missing customer: ${seed.customerName}`);
    }

    const seqResult = await client`SELECT nextval('order_number_seq') AS n`;
    const orderNumber = `ORD-${seqResult[0]!.n}`;

    const itemCount = seed.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalAmount = seed.items
      .reduce((sum, i) => sum + Number(i.totalPrice), 0)
      .toFixed(2);

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber,
        customerId: customer.id,
        status: seed.status,
        partySize: seed.partySize,
        itemCount,
        totalAmount,
        statusChangedAt: seed.createdAt,
        createdAt: seed.createdAt,
        updatedAt: seed.createdAt,
      })
      .returning();

    await db.insert(orderStatusEvents).values({
      orderId: order!.id,
      fromStatus: null,
      toStatus: "CONFIRMED",
      changedAt: seed.createdAt,
    });

    // Synthetic path into current status for demo timeline
    if (seed.status !== "CONFIRMED") {
      const path: Status[] =
        seed.status === "PREPARING"
          ? ["PREPARING"]
          : seed.status === "READY"
            ? ["PREPARING", "READY"]
            : seed.status === "COMPLETED"
              ? ["PREPARING", "READY", "COMPLETED"]
              : ["CANCELLED"];

      let from: Status = "CONFIRMED";
      for (let i = 0; i < path.length; i++) {
        const to = path[i]!;
        const t = new Date(seed.createdAt.getTime() + (i + 1) * 8 * 60_000);
        await db.insert(orderStatusEvents).values({
          orderId: order!.id,
          fromStatus: from,
          toStatus: to,
          changedAt: t,
        });
        from = to;
      }
    }

    await db.insert(orderItems).values(
      seed.items.map((item) => ({
        orderId: order!.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        createdAt: seed.createdAt,
      })),
    );

    if (seed.seatAt) {
      const table = tableByLabel[seed.seatAt];
      if (!table) throw new Error(`Missing table ${seed.seatAt}`);
      await db.insert(seatingAssignments).values({
        tableId: table.id,
        orderId: order!.id,
        partySize: seed.partySize,
        source: seed.seatSource ?? "AI",
        createdAt: seed.createdAt,
      });
      await db
        .update(diningTables)
        .set({ status: "OCCUPIED" })
        .where(eq(diningTables.id, table.id));
    }
  }

  await client`SELECT setval(
    'order_number_seq',
    (SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 1000) FROM orders)
  )`;

  console.log(
    `Seeded ${insertedCustomers.length} customers, ${orderSeeds.length} orders, ${insertedTables.length} tables.`,
  );
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
