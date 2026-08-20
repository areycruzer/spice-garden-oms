import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  customers,
  diningTables,
  orderItems,
  orderStatusEvents,
  orders,
  seatingAssignments,
} from "@spice-garden/database/schema";
import { createApp } from "../app.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://spice:spice@localhost:5432/spice_garden";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(
  __dirname,
  "../../../database/drizzle",
);

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);
const app = createApp();

async function resetDb() {
  await db.delete(seatingAssignments);
  await db.delete(orderStatusEvents);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(diningTables);
  await sql`ALTER SEQUENCE order_number_seq RESTART WITH 1001`;
}

async function json(res: Response) {
  const body = await res.json();
  return { status: res.status, body };
}

describe("API integration", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await sql.end();
  });

  it("POST /customers creates and rejects duplicate phone", async () => {
    const created = await json(
      await app.request("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aarav Sharma",
          email: "aarav@test.com",
          phone: "+919900000001",
        }),
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.phone).toBe("+919900000001");
    expect(created.body.meta).toBeUndefined();

    const dup = await json(
      await app.request("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Other",
          email: null,
          phone: "+919900000001",
        }),
      }),
    );
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("RESOURCE_ALREADY_EXISTS");
  });

  it("POST /customers returns VALIDATION_FAILED", async () => {
    const res = await json(
      await app.request("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", phone: "" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("GET /customers supports search and pagination meta", async () => {
    await app.request("/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Priya Nair",
        email: "priya@test.com",
        phone: "+919900000002",
      }),
    });

    const list = await json(await app.request("/customers?search=priya&page=1&size=10"));
    expect(list.status).toBe(200);
    expect(list.body.meta.pagination).toMatchObject({
      page: 1,
      size: 10,
      total: 1,
      totalPages: 1,
    });
    expect(list.body.data[0].name).toBe("Priya Nair");
  });

  it("GET /customers INVALID_FILTER on bad pagination", async () => {
    const res = await json(await app.request("/customers?page=0&size=10"));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILTER");
  });

  it("PATCH/DELETE customers handle not found and update", async () => {
    const missing = await json(
      await app.request("/customers/00000000-0000-4000-8000-000000000099", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "X" }),
      }),
    );
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const created = await json(
      await app.request("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Rohan Mehta",
          email: null,
          phone: "+919900000003",
        }),
      }),
    );

    const patched = await json(
      await app.request(`/customers/${created.body.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Rohan M." }),
      }),
    );
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe("Rohan M.");

    const deleted = await app.request(`/customers/${created.body.data.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);
  });

  it("POST /orders creates with new customer and recomputes totals", async () => {
    const res = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "Ananya Iyer",
            email: "ananya@test.com",
            phone: "+919900000004",
          },
          items: [
            { itemName: "Masala Dosa", quantity: 2, unitPrice: 180 },
            { itemName: "Filter Coffee", quantity: 1, unitPrice: 80 },
          ],
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBe("ORD-1001");
    expect(res.body.data.itemCount).toBe(3);
    expect(res.body.data.totalAmount).toBe(440);
    expect(typeof res.body.data.totalAmount).toBe("number");
    expect(res.body.data.items).toHaveLength(2);
    expect(typeof res.body.data.items[0].unitPrice).toBe("number");
    expect(res.body.meta).toBeUndefined();
  });

  it("POST /orders attaches existing customer and rejects empty items", async () => {
    const customer = await json(
      await app.request("/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Vikram Reddy",
          email: null,
          phone: "+919900000005",
        }),
      }),
    );

    const empty = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: customer.body.data.id,
            name: "Vikram Reddy",
            email: null,
            phone: "+919900000005",
          },
          items: [],
        }),
      }),
    );
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_FAILED");
    expect(empty.body.error.message).toContain(
      "order must contain at least one item",
    );

    const missingCustomer = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: "00000000-0000-4000-8000-000000000088",
            name: "Ghost",
            email: null,
            phone: "+919900000099",
          },
          items: [{ itemName: "Naan", quantity: 1, unitPrice: 60 }],
        }),
      }),
    );
    expect(missingCustomer.status).toBe(404);
    expect(missingCustomer.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const created = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: customer.body.data.id,
            name: "Vikram Reddy",
            email: null,
            phone: "+919900000005",
          },
          items: [{ itemName: "Butter Naan", quantity: 3, unitPrice: 60 }],
        }),
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.customerId).toBe(customer.body.data.id);
  });

  it("POST /orders returns RESOURCE_ALREADY_EXISTS on duplicate phone", async () => {
    await app.request("/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Existing",
        email: null,
        phone: "+919900000006",
      }),
    });

    const res = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "New Person",
            email: null,
            phone: "+919900000006",
          },
          items: [{ itemName: "Lassi", quantity: 1, unitPrice: 140 }],
        }),
      }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESOURCE_ALREADY_EXISTS");
  });

  it("lists orders with filters and status INVALID_FILTER", async () => {
    await app.request("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          id: null,
          name: "Sneha Pillai",
          email: null,
          phone: "+919900000007",
        },
        items: [{ itemName: "Biryani", quantity: 1, unitPrice: 380 }],
      }),
    });

    const badStatus = await json(await app.request("/orders?status=COOKING"));
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.error.code).toBe("INVALID_FILTER");

    const missingCustomer = await json(
      await app.request(
        "/orders?customerId=00000000-0000-4000-8000-000000000077",
      ),
    );
    expect(missingCustomer.status).toBe(404);
    expect(missingCustomer.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const list = await json(await app.request("/orders?search=ORD&page=1&size=10"));
    expect(list.status).toBe(200);
    expect(list.body.meta.pagination.total).toBe(1);
  });

  it("GET /orders/:id returns RESOURCE_NOT_FOUND", async () => {
    const res = await json(
      await app.request("/orders/00000000-0000-4000-8000-000000000066"),
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("status transitions and item mutations", async () => {
    const created = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "Karan Gupta",
            email: null,
            phone: "+919900000008",
          },
          items: [{ itemName: "Paneer Butter Masala", quantity: 1, unitPrice: 320 }],
        }),
      }),
    );
    const orderId = created.body.data.id as string;

    const invalid = await json(
      await app.request(`/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
    );
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const preparing = await json(
      await app.request(`/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PREPARING" }),
      }),
    );
    expect(preparing.status).toBe(200);
    expect(preparing.body.data.status).toBe("PREPARING");
    expect(preparing.body.data.statusEvents.length).toBeGreaterThanOrEqual(2);
    expect(preparing.body.data.opsInsight.diningPhase).toBe("cooking");
    expect(preparing.body.data.opsInsight.quotedReadyMinutes).toBe(
      Math.ceil(Math.max(3, 1.5 * preparing.body.data.itemCount)),
    );

    const added = await json(
      await app.request(`/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: "Butter Naan",
          quantity: 2,
          unitPrice: 60,
        }),
      }),
    );
    expect(added.status).toBe(201);
    expect(added.body.data.itemCount).toBe(3);
    expect(added.body.data.totalAmount).toBe(440);

    const itemId = added.body.data.items.find(
      (i: { itemName: string }) => i.itemName === "Butter Naan",
    ).id;

    await app.request(`/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READY" }),
    });

    const blockedAdd = await json(
      await app.request(`/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: "Lassi",
          quantity: 1,
          unitPrice: 140,
        }),
      }),
    );
    expect(blockedAdd.status).toBe(400);
    expect(blockedAdd.body.error.code).toBe("VALIDATION_FAILED");

    // Move back isn't allowed; create a fresh mutable order to test delete
    const mutable = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "Meera Krishnan",
            email: null,
            phone: "+919900000009",
          },
          items: [
            { itemName: "Gulab Jamun", quantity: 2, unitPrice: 120 },
            { itemName: "Mango Lassi", quantity: 1, unitPrice: 140 },
          ],
        }),
      }),
    );
    const mid = mutable.body.data.id as string;
    const removeId = mutable.body.data.items[0].id as string;

    const removed = await json(
      await app.request(`/orders/${mid}/items/${removeId}`, {
        method: "DELETE",
      }),
    );
    expect(removed.status).toBe(200);
    expect(removed.body.data.itemCount).toBe(1);
    expect(removed.body.data.totalAmount).toBe(140);
    expect(removed.body.data.items).toHaveLength(1);

    // silence unused
    expect(itemId).toBeTruthy();
  });

  it("records opsInsight and status events on create", async () => {
    const created = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "Ops Guest",
            email: null,
            phone: "+919900000020",
          },
          partySize: 4,
          items: [
            { itemName: "Thali", quantity: 2, unitPrice: 350 },
            { itemName: "Naan", quantity: 2, unitPrice: 60 },
          ],
        }),
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.partySize).toBe(4);
    expect(created.body.data.opsInsight.diningPhase).toBe("queued");
    expect(created.body.data.opsInsight.quotedReadyMinutes).toBe(
      Math.ceil(2 + 0.5 * 4) + Math.ceil(Math.max(3, 1.5 * 4)),
    );
    expect(created.body.data.statusEvents[0].toStatus).toBe("CONFIRMED");
  });

  it("floor suggest prefers capacity-fit free table; host override; clear on COMPLETED", async () => {
    const tables = await db
      .insert(diningTables)
      .values([
        { label: "T1", capacity: 2 },
        { label: "T3", capacity: 4 },
        { label: "T6", capacity: 6 },
      ])
      .returning();

    const created = await json(
      await app.request("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            id: null,
            name: "Floor Guest",
            email: null,
            phone: "+919900000021",
          },
          partySize: 4,
          items: [{ itemName: "Biryani", quantity: 2, unitPrice: 380 }],
        }),
      }),
    );
    const orderId = created.body.data.id as string;

    const suggest = await json(
      await app.request("/ops/floor/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      }),
    );
    expect(suggest.status).toBe(200);
    expect(suggest.body.data.table.label).toBe("T3");

    const t6 = tables.find((t) => t.label === "T6")!;
    const assignHost = await json(
      await app.request("/ops/floor/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          tableId: t6.id,
          source: "HOST",
        }),
      }),
    );
    expect(assignHost.status).toBe(200);
    const seated = assignHost.body.data.tables.find(
      (t: { label: string }) => t.label === "T6",
    );
    expect(seated.status).toBe("OCCUPIED");
    expect(seated.assignment.source).toBe("HOST");

    await app.request(`/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PREPARING" }),
    });
    await app.request(`/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READY" }),
    });
    const completed = await json(
      await app.request(`/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
    );
    expect(completed.status).toBe(200);

    const floor = await json(await app.request("/ops/floor"));
    const freed = floor.body.data.tables.find(
      (t: { label: string }) => t.label === "T6",
    );
    expect(freed.status).toBe("FREE");
    expect(freed.assignment).toBeNull();
  });
});
