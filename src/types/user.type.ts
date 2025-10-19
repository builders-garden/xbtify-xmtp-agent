import type {
	GroupMember as DbGroupMember,
	User as DbUser,
	Wallet as DbWallet,
} from "../lib/db/db.schema.js";

export type User = DbUser & {
	wallets: DbWallet[];
};

export type GroupMemberWithUser = DbGroupMember & {
	user: DbUser;
};
