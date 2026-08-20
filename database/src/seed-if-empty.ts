import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { count } from "drizzle-orm";
import { customers, diningTables } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
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

  let customerCount = 0;
  let tableCount = 0;

  try {
    const [cRow] = await db.select({ value: count() }).from(customers);
    customerCount = cRow?.value ?? 0;
    const [tRow] = await db.select({ value: count() }).from(diningTables);
    tableCount = tRow?.value ?? 0;
  } catch {
    // tables may not exist yet; migrate should have run first
  }

  if (customerCount > 0 && tableCount > 0) {
    console.log(
      `Seed skipped: ${customerCount} customers and ${tableCount} tables already present.`,
    );
    await client.end();
    return;
  }

  await client.end();

  console.log(
    customerCount === 0
      ? "Empty customers — running full seed."
      : "Missing dining tables — running full seed to load Floor Ops demo data.",
  );
  await import("./seed.js");
}

main().catch((err) => {
  console.error("seed-if-empty failed:", err);
  process.exit(1);
});
