import type { User as NeynarUser } from "@neynar/nodejs-sdk/build/api/index.js";
import { tool } from "ai";
import { z } from "zod";
import { getOrCreateUserByNeynarUser } from "../db/queries/index.js";
import { fetchUserFromNeynarByAddress } from "../neynar.js";

export const tools = {
	xbtify_create: tool({
		description:
			"If the user specify to create a new xbt ai clone, create a new xbt ai clone of the user",
		inputSchema: z.object({
			walletAddress: z
				.string()
				.describe(
					"The ethereum wallet address of the person to create the xbt ai clone for",
				),
		}),
		execute: async ({ walletAddress }) => {
			console.log(
				"[ai-sdk] [xbtify_create-tool] create a new xbt ai clone for this wallet address",
				walletAddress,
			);
			let user: NeynarUser | null = null;
			if (walletAddress) {
				user = await fetchUserFromNeynarByAddress(walletAddress);
			}
			if (!user) {
				return {
					walletAddress,
					fid: undefined,
					username: undefined,
					text: `Confirm that you want to create a new xbt ai clone for this wallet address ${walletAddress}`,
				};
			}
			// create user from neynar
			const newUser = await getOrCreateUserByNeynarUser(user);
			console.log("[ai-sdk] [track-tool] user saved in db", newUser.id);

			return {
				walletAddress,
				fid: user.fid,
				username: user.username,
				text: `Confirm that you want to create a new xbt ai clone for your wallet address ${walletAddress} (username: ${user.username} fid: ${user.fid})`,
			};
		},
	}),
};
