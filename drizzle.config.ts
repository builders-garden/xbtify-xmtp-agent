import dotenv from "dotenv";
import type { Config } from "drizzle-kit";
import { env } from "./src/lib/env";

dotenv.config({
	path: ".env",
});

export default {
	schema: "./src/lib/db/db.schema.ts",
	out: "./migrations",
	dialect: "turso",
	dbCredentials: {
		url: env.DATABASE_URL,
		authToken: env.DATABASE_TOKEN,
	},
} satisfies Config;
