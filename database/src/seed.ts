import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { customers, orders, orderItems } from "./schema.js";

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
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding Spice Garden database...");

  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await client`ALTER SEQUENCE order_number_seq RESTART WITH 1001`;

  const insertedCustomers = await db
    .insert(customers)
    .values([...CUSTOMER_SEED])
    .returning();

  const byName = Object.fromEntries(
    insertedCustomers.map((c) => [c.name, c]),
  ) as Record<string, (typeof insertedCustomers)[number]>;

  type OrderSeed = {
    customerName: string;
    status: Status;
    createdAt: Date;
    items: ReturnType<typeof line>[];
  };

  const orderSeeds: OrderSeed[] = [
    {
      customerName: "Aarav Sharma",
      status: "CONFIRMED",
      createdAt: daysAgo(0, 10),
      items: [line(0, 2), line(3, 4), line(5, 2)],
    },
    {
      customerName: "Priya Nair",
      status: "CONFIRMED",
      createdAt: daysAgo(0, 11),
      items: [line(2, 2), line(5, 1)],
    },
    {
      customerName: "Rohan Mehta",
      status: "CONFIRMED",
      createdAt: daysAgo(1, 9),
      items: [line(1, 1), line(3, 2), line(4, 2)],
    },
    {
      customerName: "Ananya Iyer",
      status: "PREPARING",
      createdAt: daysAgo(0, 8),
      items: [line(7, 1), line(3, 3), line(5, 2)],
    },
    {
      customerName: "Vikram Reddy",
      status: "PREPARING",
      createdAt: daysAgo(1, 14),
      items: [line(8, 2), line(9, 2)],
    },
    {
      customerName: "Sneha Pillai",
      status: "PREPARING",
      createdAt: daysAgo(2, 13),
      items: [line(0, 1), line(6, 1), line(3, 2)],
    },
    {
      customerName: "Karan Gupta",
      status: "READY",
      createdAt: daysAgo(0, 7),
      items: [line(1, 2), line(5, 2)],
    },
    {
      customerName: "Meera Krishnan",
      status: "READY",
      createdAt: daysAgo(1, 16),
      items: [line(2, 3), line(4, 2), line(9, 1)],
    },
    {
      customerName: "Aarav Sharma",
      status: "READY",
      createdAt: daysAgo(2, 12),
      items: [line(7, 2), line(3, 4)],
    },
    {
      customerName: "Priya Nair",
      status: "COMPLETED",
      createdAt: daysAgo(3, 19),
      items: [line(0, 1), line(1, 1), line(3, 2), line(4, 1)],
    },
    {
      customerName: "Rohan Mehta",
      status: "COMPLETED",
      createdAt: daysAgo(4, 18),
      items: [line(8, 1), line(5, 2)],
    },
    {
      customerName: "Ananya Iyer",
      status: "COMPLETED",
      createdAt: daysAgo(5, 20),
      items: [line(2, 2), line(3, 2), line(9, 2)],
    },
    {
      customerName: "Vikram Reddy",
      status: "COMPLETED",
      createdAt: daysAgo(6, 13),
      items: [line(6, 2), line(3, 4), line(4, 2)],
    },
    {
      customerName: "Sneha Pillai",
      status: "CANCELLED",
      createdAt: daysAgo(2, 10),
      items: [line(1, 1), line(5, 1)],
    },
    {
      customerName: "Karan Gupta",
      status: "CANCELLED",
      createdAt: daysAgo(3, 11),
      items: [line(0, 2), line(3, 2)],
    },
    {
      customerName: "Meera Krishnan",
      status: "CANCELLED",
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
        itemCount,
        totalAmount,
        createdAt: seed.createdAt,
        updatedAt: seed.createdAt,
      })
      .returning();

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
  }

  await client`SELECT setval(
    'order_number_seq',
    (SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 1000) FROM orders)
  )`;

  console.log(
    `Seeded ${insertedCustomers.length} customers and ${orderSeeds.length} orders.`,
  );
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
