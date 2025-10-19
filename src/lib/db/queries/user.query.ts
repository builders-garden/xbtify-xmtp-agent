import type { MiniAppNotificationDetails } from "@farcaster/miniapp-sdk";
import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type Address, getAddress, isAddressEqual } from "viem";
import type { User } from "../../../types/user.type.js";
import { formatAvatarSrc } from "../../../utils/general.js";
import { env } from "../../env.js";
import {
	fetchUserFromNeynarByAddress,
	fetchUserFromNeynarByFid,
} from "../../neynar.js";
import { userTable } from "../db.schema.js";
import { db } from "../index.js";
import { addUserWallets, getUserFromWalletAddress } from "./wallet.query.js";

/**
 * Create a user in the database
 * @param user - The user to create
 * @param referrerFid - The Farcaster fid of the referrer
 * @returns The created user
 */
async function createUserFromNeynar(
	user: NeynarUser,
	referrerFid?: number,
): Promise<User> {
	const dbUser = await db
		.insert(userTable)
		.values({
			username: user.username,
			avatarUrl: user.pfp_url ? formatAvatarSrc(user.pfp_url) : null,
			farcasterFid: user.fid,
			farcasterUsername: user.username,
			farcasterDisplayName: user.display_name,
			farcasterAvatarUrl: user.pfp_url ? formatAvatarSrc(user.pfp_url) : null,
			farcasterWallets: user.verified_addresses.eth_addresses.map((address) =>
				getAddress(address),
			),
			farcasterNotificationDetails: null,
			farcasterReferrerFid: referrerFid ? referrerFid : null,
		})
		.returning();
	const primaryEthAddress = user.verified_addresses.primary.eth_address;
	const ethAddresses = user.verified_addresses.eth_addresses.map((address) => ({
		address: getAddress(address),
		isPrimary: primaryEthAddress
			? isAddressEqual(getAddress(primaryEthAddress), getAddress(address))
			: false,
	}));
	const wallets = await addUserWallets(dbUser[0].id, ethAddresses);
	return { ...dbUser[0], wallets };
}

/**
 * Create a user in the database
 * @param user - The user to create
 * @param referrerFid - The Farcaster fid of the referrer
 * @returns The created user
 */
async function createUserFromWalletAddress(
	address: Address,
	inboxId?: string,
	farcasterUser?: NeynarUser,
): Promise<User> {
	const [dbUser] = await db
		.insert(userTable)
		.values({
			username: farcasterUser?.username || null,
			avatarUrl: farcasterUser?.pfp_url
				? formatAvatarSrc(farcasterUser.pfp_url)
				: null,
			inboxId: inboxId || null,
			farcasterFid: farcasterUser?.fid || null,
			farcasterUsername: farcasterUser?.username || null,
			farcasterDisplayName: farcasterUser?.display_name || null,
			farcasterAvatarUrl: farcasterUser?.pfp_url
				? formatAvatarSrc(farcasterUser.pfp_url)
				: null,
			farcasterWallets: farcasterUser
				? farcasterUser.verified_addresses.eth_addresses.map((a) =>
						getAddress(a),
					)
				: [],
			farcasterNotificationDetails: null,
			farcasterReferrerFid: null,
		})
		.returning();

	const addresses = [
		getAddress(address),
		...(farcasterUser?.verified_addresses.eth_addresses.map((a) =>
			getAddress(a),
		) || []),
	];
	const addressSetArray = Array.from(new Set(addresses));

	const wallets = await addUserWallets(
		dbUser.id,
		addressSetArray.map((a) => ({
			address: a,
			isPrimary: a === getAddress(address),
		})),
	);
	const ensOrBaseName = wallets.find(
		(wallet) => wallet.ensName || wallet.baseName,
	);
	if (ensOrBaseName && !farcasterUser) {
		// if the user doesnt have farcaster associated => add avatar and username based on ENS
		await updateUser(dbUser.id, {
			username: ensOrBaseName.ensName || ensOrBaseName.baseName || null,
			avatarUrl:
				ensOrBaseName.ensAvatarUrl || ensOrBaseName.baseAvatarUrl || null,
		});
	}
	return { ...dbUser, wallets };
}

/**
 * Get user by XMTP inboxId
 */
export const getUserByInboxId = async (
	inboxId: string,
): Promise<User | null> => {
	const row = await db.query.userTable.findFirst({
		where: eq(userTable.inboxId, inboxId),
		with: {
			wallets: true,
		},
	});
	if (!row) {
		return null;
	}
	return row;
};

/**
 * Get or create user by inboxId
 */
export const getOrCreateUserByInboxId = async (
	inboxId: string,
	address?: string,
): Promise<User | null> => {
	const existing = await getUserByInboxId(inboxId);
	if (existing) {
		return existing;
	}
	if (address) {
		const neynarUser = await fetchUserFromNeynarByAddress(address);
		return await createUserFromWalletAddress(
			getAddress(address),
			inboxId,
			neynarUser ?? undefined,
		);
	}
	return null;
};

/**
 * Get users by a list of inboxIds
 */
export const getUsersByInboxIds = async (
	inboxIds: string[],
): Promise<User[]> => {
	if (inboxIds.length === 0) return [];
	const rows = await db.query.userTable.findMany({
		where: inArray(userTable.inboxId, inboxIds),
		with: { wallets: true },
	});
	return rows;
};

/**
 * Get or create users by inboxIds
 * @param data - The data to get or create users by inboxIds
 * @returns
 */
export const getOrCreateUsersByInboxIds = async (
	data: { inboxId: string; address: string }[],
) => {
	const inboxIds = data.map((d) => d.inboxId);
	const existing = await getUsersByInboxIds(inboxIds);
	const existingInboxIds = new Set(
		existing.map((r) => r.inboxId).filter((v): v is string => Boolean(v)),
	);
	const toCreate = data.filter((d) => !existingInboxIds.has(d.inboxId));
	const created = await Promise.all(
		toCreate.map(async (d) => {
			const neynarUser = await fetchUserFromNeynarByAddress(d.address);
			return await createUserFromWalletAddress(
				getAddress(d.address),
				d.inboxId,
				neynarUser ?? undefined,
			);
		}),
	);
	return [...existing, ...created];
};

/**
 * Get a user from their ID
 * @param id - The database ID of the user
 * @returns The user item
 */
export const getUserFromId = async (userId: string): Promise<User | null> => {
	if (!userId) {
		return null;
	}

	const row = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		with: {
			wallets: true,
		},
	});

	return row ?? null;
};

/**
 * Get a user from their Farcaster fid
 * @param fid - The Farcaster fid of the user
 * @returns The user or null if the user is not found
 */
export async function getUserFromFid(fid: number): Promise<User | null> {
	if (fid < 0) {
		return null;
	}

	const row = await db.query.userTable.findFirst({
		where: eq(userTable.farcasterFid, fid),
		with: {
			wallets: true,
		},
	});

	return row ?? null;
}

/**
 * Get a user from their Farcaster fid or create them if they don't exist
 * @param fid - The Farcaster fid of the user
 * @param referrerFid - The Farcaster fid of the referrer
 * @returns The user in the database
 */
export async function getOrCreateUserFromFid(
	fid: number,
	referrerFid?: number,
): Promise<User> {
	const user = await getUserFromFid(fid);
	if (user) {
		return user;
	}
	// else create the user fetching data from neynar
	const userFromNeynar = await fetchUserFromNeynarByFid(fid);
	if (!userFromNeynar) {
		console.error("FID not found in Neynar", fid, referrerFid);
		throw new Error("Farcaster user not found in Neynar");
	}

	const dbUser = await createUserFromNeynar(userFromNeynar, referrerFid);
	return dbUser;
}

/**
 * Get or create user by Farcaster FID
 * @param user - The Farcaster user
 * @returns
 */
export const getOrCreateUserByNeynarUser = async (
	neynarUser: NeynarUser,
): Promise<User> => {
	const existing = await getUserFromFid(neynarUser.fid);
	if (existing) {
		return existing;
	}

	const address =
		neynarUser.verified_addresses.primary.eth_address ?? undefined;
	if (!address) {
		throw new Error("Cannot create user without a custody address");
	}
	return createUserFromWalletAddress(
		getAddress(address),
		undefined,
		neynarUser,
	);
};

/**
 * Get a user from their wallet address or create them if they don't exist
 * @param address - The wallet address
 * @returns The user in the database
 */
export const getOrCreateUserFromWalletAddress = async (
	address: Address,
	farcasterUser?: NeynarUser,
): Promise<User> => {
	const user = await getUserFromWalletAddress(address);
	if (user) {
		return user;
	}
	const dbUser = await createUserFromWalletAddress(
		address,
		undefined,
		farcasterUser,
	);
	return dbUser;
};

/**
 * Get the notification details for a user
 * @param fid - The Farcaster FID of the user
 * @returns The notification details
 */
export const getUserNotificationDetails = async (
	fid: number,
): Promise<MiniAppNotificationDetails | null> => {
	const notificationDetails = await db.query.userTable.findFirst({
		where: eq(userTable.farcasterFid, fid),
		columns: {
			farcasterNotificationDetails: true,
		},
	});
	if (!notificationDetails) {
		return null;
	}

	try {
		return notificationDetails.farcasterNotificationDetails;
	} catch (_error) {
		return null;
	}
};

/**
 * Set the notification details for a user
 * @param fid - The Farcaster FID of the user
 * @param notificationDetails - The notification details to set
 * @returns The updated user
 */
export const setUserNotificationDetails = async (
	fid: number,
	notificationDetails: MiniAppNotificationDetails,
) =>
	await db
		.update(userTable)
		.set({
			farcasterNotificationDetails: notificationDetails,
		})
		.where(eq(userTable.farcasterFid, fid));

/**
 * Delete the notification details for a user
 * @param fid - The Farcaster FID of the user
 * @returns The updated user
 */
export const deleteUserNotificationDetails = async (fid: number) =>
	await db
		.update(userTable)
		.set({
			farcasterNotificationDetails: null,
		})
		.where(eq(userTable.farcasterFid, fid));

/**
 * Get all users with notification details
 * @returns All users with notification details
 */
export const getAllUsersNotificationDetails = async (): Promise<
	| {
			farcasterFid: number;
			farcasterNotificationDetails: MiniAppNotificationDetails;
	  }[]
	| null
> => {
	const userNotificationDetails = await db.query.userTable.findMany({
		where: and(
			isNotNull(userTable.farcasterNotificationDetails),
			isNotNull(userTable.farcasterFid),
		),
		columns: {
			farcasterFid: true,
			farcasterNotificationDetails: true,
		},
	});
	if (!userNotificationDetails) {
		return null;
	}
	const results = userNotificationDetails
		.map((user) => ({
			farcasterFid: user.farcasterFid,
			farcasterNotificationDetails: user.farcasterNotificationDetails,
		}))
		.filter(
			(
				u,
			): u is {
				farcasterFid: number;
				farcasterNotificationDetails: MiniAppNotificationDetails;
			} => u.farcasterFid !== null && u.farcasterNotificationDetails !== null,
		);
	return results;
};

/**
 * Update a user in the database
 * @param userId - The database ID of the user
 * @param newUser - The new user data
 * @returns The updated user
 */
export const updateUser = async (userId: string, newUser: Partial<User>) =>
	await db.update(userTable).set(newUser).where(eq(userTable.id, userId));

/**
 * Set the paid transaction hash for a user
 * @param userId - The database ID of the user
 * @param paidTxHash - The transaction hash of the payment
 * @returns The updated user
 */
export const setUserPaidTxHash = async (
	senderAddress: string,
	paidTxHash: string,
) => {
	const user = await getUserFromWalletAddress(getAddress(senderAddress));
	if (!user) {
		throw new Error("User not found");
	}

	const updatedUser = await db
		.update(userTable)
		.set({ paidTxHash })
		.where(eq(userTable.id, user.id));

	// auto init the agent with the user data
	if (user.farcasterFid) {
		await fetch(`${env.BACKEND_URL}/api/agent/init`, {
			method: "POST",
			headers: {
				"x-api-key": env.BACKEND_API_KEY,
			},
			body: JSON.stringify({
				fid: user.farcasterFid,
				personality: "none",
				tone: "none",
				movieCharacter: "none",
				walletAddress: senderAddress,
			}),
		});
	} else {
		console.warn("User has no Farcaster FID, skipping agent initialization");
	}

	return updatedUser;
};
