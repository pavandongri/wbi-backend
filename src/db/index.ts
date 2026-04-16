import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

export const pool = new Pool({
  connectionString: env.DATABASE_URL
});

export const db = drizzle(pool, { schema });

export async function checkDbConnection(): Promise<void> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }
  const client = await pool.connect();
  try {
    await client.query("SELECT 1 as ok");
  } finally {
    client.release();
  }
}
