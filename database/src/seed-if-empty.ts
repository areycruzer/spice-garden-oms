import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { count } from "drizzle-orm";
import { customers } from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const client = postgres(databaseUrl, { max: 1, ssl: "require" });
  const db = drizzle(client);

  try {
    const [row] = await db.select({ value: count() }).from(customers);
    if ((row?.value ?? 0) > 0) {
      console.log(`Seed skipped: ${row!.value} customers already present.`);
      await client.end();
      return;
    }
  } catch {
    // tables may not exist yet; migrate should have run first
  }

  await client.end();

  // Re-run full seed script
  await import("./seed.js");
}

main().catch((err) => {
  console.error("seed-if-empty failed:", err);
  process.exit(1);
});
