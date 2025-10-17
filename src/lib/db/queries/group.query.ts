import {
	type GroupMember,
	IdentifierKind,
	type Group as XmtpGroup,
} from "@xmtp/agent-sdk";
import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { Address } from "viem";
import { XMTP_AGENTS } from "../../xmtp-agents.js";
import {
	type CreateGroup,
	type CreateGroupMember,
	type Group,
	groupMemberTable,
	groupTable,
	type UpdateGroup,
} from "../db.schema.js";
import { db } from "../index.js";
import {
	getOrCreateUserByInboxId,
	getOrCreateUsersByInboxIds,
	getUsersByInboxIds,
} from "./user.query.js";

/**
 * Get group by id
 * @param conversationId - The group conversation id
 * @returns The group
 */
export const getGroupByConversationId = async (conversationId: string) => {
	const newGroup = await db.query.groupTable.findFirst({
		where: eq(groupTable.conversationId, conversationId),
		with: {
			members: {
				with: {
					user: true,
				},
			},
		},
	});
	return newGroup;
};

/**
 * Create group
 * @param newGroup - The group to create
 * @returns The created group
 */
export const createGroup = async (newGroup: CreateGroup) => {
	const [createdGroup] = await db
		.insert(groupTable)
		.values(newGroup)
		.returning();
	return createdGroup;
};

/**
 * Update group
 * @param newGroup - The group to update
 * @returns The updated group
 */
export const updateGroup = async (newGroup: UpdateGroup) => {
	if (!newGroup.id) {
		console.error("Group ID is required for this group", newGroup);
		throw new Error("Group ID is required");
	}
	const [updatedGroup] = await db
		.update(groupTable)
		.set(newGroup)
		.where(eq(groupTable.id, newGroup.id))
		.returning();
	return updatedGroup;
};

/**
 * Delete group by id
 * @param groupId - The group id
 */
export const deleteGroupById = async (groupId: string) => {
	return await db.delete(groupTable).where(eq(groupTable.id, groupId));
};

/**
 * Upsert members for a group based on inboxIds
 */
export const upsertGroupMembers = async (
	groupId: string,
	membersRaw: GroupMember[],
	_agentAddress: string,
	agentInboxId: string,
) => {
	// filter out the agent from the members
	const members = membersRaw.filter((m) => m.inboxId !== agentInboxId);
	if (members.length === 0) return;

	// Ensure all users exist for given inboxIds and the members are not in the XMTP agents list
	const data = members
		.map((m) => ({
			inboxId: m.inboxId,
			address: m.accountIdentifiers.find(
				(i) => i.identifierKind === IdentifierKind.Ethereum,
			)?.identifier,
		}))
		.filter(
			(m) =>
				!XMTP_AGENTS.some(
					(a) => a.address.toLowerCase() === m.address?.toLowerCase(),
				),
		)
		.filter((m) => m.address !== undefined);
	const users = await getOrCreateUsersByInboxIds(
		data.map((d) => ({
			inboxId: d.inboxId,
			// biome-ignore lint/style/noNonNullAssertion: address is not undefined
			address: d.address!,
		})),
	);

	const rows: CreateGroupMember[] = users.map((u) => ({
		id: ulid(),
		groupId,
		userId: u.id,
	}));

	// Insert ignoring duplicates via unique index (groupId,userId)
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();
};

/**
 * Upsert members for a dm based on inboxId
 */
export const addDmMember = async (
	groupId: string,
	inboxId: string,
	walletAddress: Address,
) => {
	// Ensure all users exist for given inboxIds and the members are not in the XMTP agents list
	const users = await getOrCreateUsersByInboxIds([
		{
			inboxId,
			address: walletAddress,
		},
	]);

	const rows: CreateGroupMember[] = users.map((u) => ({
		id: ulid(),
		groupId,
		userId: u.id,
	}));

	// Insert ignoring duplicates via unique index (groupId,userId)
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();
};

/**
 * Add group members by inboxIds (idempotent)
 */
export const addGroupMembersByInboxIds = async (
	groupId: string,
	members: { inboxId: string; address?: string }[],
): Promise<void> => {
	if (members.length === 0) return;
	// Ensure user s exist (creating as needed)
	const users = await Promise.all(
		members.map((member) =>
			getOrCreateUserByInboxId(member.inboxId, member.address),
		),
	);
	const rows: CreateGroupMember[] = users.map((u) => ({
		id: ulid(),
		groupId,
		userId: u?.id ?? "",
	}));
	// Insert, ignoring duplicates
	await db.insert(groupMemberTable).values(rows).onConflictDoNothing();
};

/**
 * Remove group members by inboxIds
 */
export const removeGroupMembersByInboxIds = async (
	groupId: string,
	inboxIds: string[],
) => {
	if (inboxIds.length === 0) return;
	const users = await getUsersByInboxIds(inboxIds);
	const userIds = users.map((u) => u.id);
	if (userIds.length === 0) return;

	// remove members from group members
	await db
		.delete(groupMemberTable)
		.where(
			and(
				eq(groupMemberTable.groupId, groupId),
				inArray(groupMemberTable.userId, userIds),
			),
		);
};

/**
 * Get or create group by conversation id
 * @param conversationId - The group conversation id
 * @param xmtpGroup - The XMTP group
 * @returns The group and whether it is new
 */
export const getOrCreateGroupByConversationId = async (
	conversationId: string,
	xmtpGroup: XmtpGroup,
	agentAddress: string,
	agentInboxId: string,
): Promise<{ group: Group; isNew: boolean }> => {
	const group = await getGroupByConversationId(conversationId);
	if (!group) {
		const newGroup = await createGroup({
			id: ulid(),
			conversationId,
			name: xmtpGroup.name,
			description: xmtpGroup.description,
			imageUrl: xmtpGroup.imageUrl,
		});
		const members = await xmtpGroup.members();
		await upsertGroupMembers(newGroup.id, members, agentAddress, agentInboxId);
		return { group: newGroup, isNew: true };
	}
	return { group, isNew: false };
};

/**
 * Get or create group by conversation id
 * @param conversationId - The group conversation id
 * @param xmtpGroup - The XMTP group
 * @returns The group and whether it is new
 */
export const getOrCreateDmByConversationId = async (
	conversationId: string,
	walletAddress: Address,
	inboxId: string,
): Promise<{ group: Group; isNew: boolean }> => {
	const dm = await getGroupByConversationId(conversationId);
	if (!dm) {
		const newDm = await createGroup({
			id: ulid(),
			conversationId,
			name: undefined,
			description: undefined,
			imageUrl: undefined,
		});
		await addDmMember(newDm.id, inboxId, walletAddress);
		return { group: newDm, isNew: true };
	}
	return { group: dm, isNew: false };
};
