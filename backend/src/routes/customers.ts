import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, count, eq, ilike, or, sql } from "drizzle-orm";
import { customers } from "@spice-garden/database/schema";
import { db } from "../db/index.js";
import { alreadyExists, notFound, validationFailed } from "../lib/errors.js";
import { mapCustomer } from "../lib/mappers.js";
import { buildPaginationMeta, parsePagination } from "../lib/pagination.js";
import { okData, okPaginated } from "../lib/response.js";
import { zodErrorHook } from "../lib/zod-hook.js";

const createCustomerSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1, "phone is required"),
});

const patchCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(1).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one field is required",
  });

export const customersRouter = new Hono();

customersRouter.get("/", async (c) => {
  const { search, page, size } = c.req.query();
  const pagination = parsePagination(page, size);

  const conditions = [];
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.email, term),
        ilike(customers.phone, term),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ value: count() })
    .from(customers)
    .where(where);

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(sql`${customers.createdAt} DESC`)
    .limit(pagination.size)
    .offset(pagination.offset);

  return c.json(
    okPaginated(
      rows.map(mapCustomer),
      buildPaginationMeta(pagination.page, pagination.size, totalRow?.value ?? 0),
    ),
  );
});

customersRouter.post(
  "/",
  zValidator("json", createCustomerSchema, zodErrorHook),
  async (c) => {
    const body = c.req.valid("json");
    const email = body.email === undefined ? null : body.email;

    try {
      const [created] = await db
        .insert(customers)
        .values({
          name: body.name,
          email,
          phone: body.phone,
        })
        .returning();

      return c.json(okData(mapCustomer(created!)), 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw alreadyExists("A customer with this phone already exists");
      }
      throw err;
    }
  },
);

customersRouter.patch(
  "/:id",
  zValidator("json", patchCustomerSchema, zodErrorHook),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!existing) {
      throw notFound(`Customer ${id} not found`);
    }

    try {
      const [updated] = await db
        .update(customers)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      return c.json(okData(mapCustomer(updated!)));
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw alreadyExists("A customer with this phone already exists");
      }
      throw err;
    }
  },
);

customersRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id));

  if (!existing) {
    throw notFound(`Customer ${id} not found`);
  }

  try {
    await db.delete(customers).where(eq(customers.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw validationFailed("Cannot delete customer with existing orders");
    }
    throw err;
  }

  return c.body(null, 204);
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23503"
  );
}
