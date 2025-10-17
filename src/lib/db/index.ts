/** biome-ignore-all lint/performance/noNamespaceImport: drizzle import schema */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env.js";
import * as dbSchema from "./db.schema.js";

export const pool = new Pool({
	connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, {
	schema: dbSchema,
});
