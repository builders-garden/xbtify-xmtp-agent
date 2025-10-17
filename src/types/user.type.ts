import type {
	User as DbUser,
	Wallet as DbWallet,
} from "../lib/db/db.schema.js";

export type User = DbUser & {
	wallets: DbWallet[];
};
