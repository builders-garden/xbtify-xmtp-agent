import type { MiniAppNotificationDetails } from "@farcaster/miniapp-core";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import type { Address } from "viem";

/**
 * Farcaster User table
 */
export const userTable = pgTable("user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => ulid()),
	avatarUrl: text("avatar_url"),
	username: text("username"),
	inboxId: text("inbox_id").unique(),
	// flags
	paidTxHash: text("paid_tx_hash").default(""),
	// Farcaster
	farcasterFid: integer("farcaster_fid").unique(),
	farcasterUsername: text("farcaster_username"),
	farcasterDisplayName: text("farcaster_display_name"),
	farcasterAvatarUrl: text("farcaster_avatar_url"),
	farcasterNotificationDetails: jsonb(
		"farcaster_notification_details",
	).$type<MiniAppNotificationDetails | null>(),
	farcasterWallets: jsonb("farcaster_wallets").$type<Address[]>(),
	farcasterReferrerFid: integer("farcaster_referrer_fid"),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export type User = typeof userTable.$inferSelect;
export type CreateUser = typeof userTable.$inferInsert;
export type UpdateUser = Partial<CreateUser>;

export const walletTable = pgTable(
	"wallet",
	{
		address: text("address").$type<Address>().primaryKey(),
		ensName: text("ens_name"),
		baseName: text("base_name"),
		ensAvatarUrl: text("ens_avatar_url"),
		baseAvatarUrl: text("base_avatar_url"),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		isPrimary: boolean("is_primary").default(false),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [index("idx_wallet_user_id").on(t.userId)],
);

export type Wallet = typeof walletTable.$inferSelect;
export type CreateWallet = typeof walletTable.$inferInsert;
export type UpdateWallet = Partial<CreateWallet>;

/**
 * Cast table
 */
export const castTable = pgTable(
	"cast",
	{
		hash: text("hash").primaryKey(),
		fid: integer("fid").notNull(),
		text: text("text").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [index("idx_cast_fid").on(t.fid)],
);

export type Cast = typeof castTable.$inferSelect;
export type CreateCast = typeof castTable.$inferInsert;
export type UpdateCast = Partial<CreateCast>;

/**
 * Reply table
 */
export const replyTable = pgTable(
	"reply",
	{
		hash: text("hash").primaryKey(),
		fid: integer("fid").notNull(),
		text: text("text").notNull(),
		parentText: text("parent_text").notNull(),
		parentAuthorFid: text("parent_author_fid").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [index("idx_reply_fid").on(t.fid)],
);

export type Reply = typeof replyTable.$inferSelect;
export type CreateReply = typeof replyTable.$inferInsert;
export type UpdateReply = Partial<CreateReply>;

/**
 * Agent table
 */
export const agentTable = pgTable(
	"agent",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => ulid()),
		fid: integer("fid").notNull().unique(),
		creatorFid: integer("creator_fid")
			.notNull()
			.references(() => userTable.farcasterFid, { onDelete: "cascade" }),
		// prompt custom sections
		styleProfilePrompt: text("style_profile_prompt"),
		topicPatternsPrompt: text("topic_patterns_prompt"),
		keywords: text("keywords"),
		// custom prompt questions
		personality: text("personality"), // degen, artist, business, builder
		tone: text("tone"), // formal, enthusiastic, humorous, irreverent
		movieCharacter: text("movie_character"), // hero, villain, supporting, mentor
		// farcaster user data
		username: text("username"),
		displayName: text("display_name"),
		avatarUrl: text("avatar_url"),
		address: text("address"),
		privateKey: text("private_key"),
		mnemonic: text("mnemonic"),
		signerUuid: text("signer_uuid"),

		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date()),
		status: text("status").notNull(),
	},
	(t) => [index("idx_agent_creator_fid").on(t.creatorFid)],
);

export type Agent = typeof agentTable.$inferSelect;
export type CreateAgent = typeof agentTable.$inferInsert;
export type UpdateAgent = Partial<CreateAgent>;

export const groupTable = pgTable(
	"group",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id").notNull(),
		name: text("name"),
		description: text("description"),
		imageUrl: text("image_url"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [uniqueIndex("group_conversation_id_unique_idx").on(t.conversationId)],
);

export type Group = typeof groupTable.$inferSelect;
export type CreateGroup = typeof groupTable.$inferInsert;
export type UpdateGroup = Partial<CreateGroup>;

// Group members
export const groupMemberTable = pgTable(
	"group_member",
	{
		id: text("id").primaryKey().notNull(),
		groupId: text("group_id")
			.notNull()
			.references(() => groupTable.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [
		uniqueIndex("group_member_group_user_unique_idx").on(t.groupId, t.userId),
	],
);

export type GroupMember = typeof groupMemberTable.$inferSelect;
export type CreateGroupMember = typeof groupMemberTable.$inferInsert;

// Agent cast table
export const agentCastTable = pgTable("agent_cast", {
	id: text("id").primaryKey(),
	agentFid: integer("agent_fid").references(() => agentTable.fid, {
		onDelete: "cascade",
	}),
	castHash: text("cast_hash").notNull(),
	castText: text("cast_text").notNull(),
	parentCastHash: text("parent_cast_hash"),
	parentCastText: text("parent_cast_text"),
	parentCastAuthorFid: integer("parent_cast_author_fid"),
	createdAt: timestamp("created_at").defaultNow(),
});

export type AgentCast = typeof agentCastTable.$inferSelect;
export type CreateAgentCast = typeof agentCastTable.$inferInsert;
export type UpdateAgentCast = Partial<CreateAgentCast>;

/**
 * Drizzle Relations
 */
export const userRelations = relations(userTable, ({ many }) => ({
	wallets: many(walletTable),
	groupMembers: many(groupMemberTable),
}));

export const walletRelations = relations(walletTable, ({ one }) => ({
	user: one(userTable, {
		fields: [walletTable.userId],
		references: [userTable.id],
	}),
}));

export const castRelations = relations(castTable, ({ one }) => ({
	user: one(userTable, {
		fields: [castTable.fid],
		references: [userTable.farcasterFid],
	}),
}));

export const replyRelations = relations(replyTable, ({ one }) => ({
	user: one(userTable, {
		fields: [replyTable.fid],
		references: [userTable.farcasterFid],
	}),
}));

export const agentRelations = relations(agentTable, ({ one, many }) => ({
	creator: one(userTable, {
		fields: [agentTable.creatorFid],
		references: [userTable.farcasterFid],
	}),
	casts: many(agentCastTable),
}));

export const groupRelations = relations(groupTable, ({ many }) => ({
	members: many(groupMemberTable),
}));

export const groupMemberRelations = relations(groupMemberTable, ({ one }) => ({
	user: one(userTable, {
		fields: [groupMemberTable.userId],
		references: [userTable.id],
	}),
	group: one(groupTable, {
		fields: [groupMemberTable.groupId],
		references: [groupTable.id],
	}),
}));

export const agentCastRelations = relations(agentCastTable, ({ one }) => ({
	agent: one(agentTable, {
		fields: [agentCastTable.agentFid],
		references: [agentTable.fid],
	}),
}));
