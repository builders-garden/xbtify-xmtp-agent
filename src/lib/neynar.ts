import { Configuration, NeynarAPIClient } from "@neynar/nodejs-sdk";
import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { formatAvatarSrc } from "../utils/index.js";
import { env } from "./env.js";

const config = new Configuration({
	apiKey: env.NEYNAR_API_KEY,
});

const neynarClient = new NeynarAPIClient(config);

/**
 * Fetch multiple users from Neynar
 * @param fids - comma separated FIDs of the users to fetch
 * @returns The users
 */
export const fetchBulkUsersFromNeynar = async (
	fids: number[],
	viewerFid?: number,
): Promise<NeynarUser[]> => {
	if (!fids) return [];

	const data = await neynarClient.fetchBulkUsers({
		fids,
		viewerFid,
	});

	return data.users || [];
};

/**
 * Fetch a single user from Neynar
 * @param fid - The FID of the user to fetch
 * @returns The user
 */
export const fetchUserFromNeynarByFid = async (
	fid: number,
): Promise<NeynarUser | null> => {
	if (!fid) return null;
	const users = await fetchBulkUsersFromNeynar([fid]);
	if (!users || users.length === 0) return null;
	return users[0];
};

/**
 * Search for users by username
 * @param username - The username to search for
 * @param viewerFid - The FID of the viewer
 * @returns The users
 */
export const searchUserByUsername = async (
	username: string,
	viewerFid?: number,
): Promise<NeynarUser | null> => {
	const data = await neynarClient.searchUser({
		q: username,
		limit: 1,
		viewerFid,
	});

	if (!data.result?.users) {
		return null;
	}
	const users = data.result.users.map((user) => ({
		...user,
		pfp_url: user.pfp_url ? formatAvatarSrc(user.pfp_url) : "",
	}));
	return users[0];
};

/**
 * Fetch a neynar user by address
 * @param address - The address to fetch the user by
 * @returns The user
 */
export const fetchUserFromNeynarByAddress = async (
	address: string,
	viewerFid?: number,
): Promise<NeynarUser | null> => {
	const data = await neynarClient.fetchBulkUsersByEthOrSolAddress({
		addresses: [address],
		viewerFid,
	});
	const userArray = data[address.toLowerCase()];
	return userArray && userArray.length > 0 ? userArray[0] : null;
};
