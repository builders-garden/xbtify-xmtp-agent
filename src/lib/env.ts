import dotenv from "dotenv";
import { isHex } from "viem";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	APP_URL: z.url().min(1),

	// Server
	PORT: z
		.string()
		.refine((val) => !Number.isNaN(Number(val)), {
			message: "PORT must be a number",
		})
		.optional()
		.default("3001"),
	NODE_ENV: z
		.enum(["development", "production"])
		.optional()
		.default("production"),

	// Backend API key
	API_KEY: z.string().min(1),

	// XMTP Agent
	XMTP_ENV: z
		.enum(["dev", "local", "production"])
		.optional()
		.default("production"),
	XMTP_WALLET_KEY: z
		.string()
		.refine((val) => isHex(val), {
			message: "XMTP_WALLET_KEY must be a valid hex string",
		})
		.min(1),
	XMTP_DB_ENCRYPTION_KEY: z.string().optional(),
	// Fix Railway volume mount path
	RAILWAY_VOLUME_MOUNT_PATH: z.string().optional().default("."),

	// Database, get yours at get yours at https://railway.com
	DATABASE_URL: z.string().min(1),

	// Neynar, get yours at https://dev.neynar.com
	NEYNAR_API_KEY: z.string().min(1),

	// OpenAI API key, get yours at https://platform.openai.com
	OPENAI_API_KEY: z.string().min(1),

	// PAYMASTERS, if base -> coinbase cdp; else -> Pimlico ###
	// Coinbase Developer Platform Client Api Key, get yours at https://portal.cdp.coinbase.com
	COINBASE_CDP_CLIENT_API_KEY: z.string().min(1),
	// Pimlico API KEY, get yours at https://dashboard.pimlico.io
	PIMLICO_API_KEY: z.string().min(1),

	// Infura API key, get yours at https://infura.io
	INFURA_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
