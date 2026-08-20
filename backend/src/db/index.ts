import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@spice-garden/database/schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://spice:spice@localhost:5432/spice_garden";

export const sql = postgres(databaseUrl);
export const db = drizzle(sql, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
