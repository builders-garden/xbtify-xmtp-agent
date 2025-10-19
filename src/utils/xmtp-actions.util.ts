import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { type Address, parseUnits } from "viem";
import { base } from "viem/chains";
import {
	ACTIONS_MESSAGE,
	AGENT_TRANSFER_AMOUNT,
	BASE_USDC_ADDRESS,
} from "../lib/constants.js";
import { env } from "../lib/env.js";
import { getBaseUsdcBalance, transferERC20 } from "../utils/index.js";
import { ActionBuilder, buildTransferAction, registerAction } from "./index.js";

/**
 * Register XMTP actions
 * @param erc20Handler - The ERC20 handler
 */
export const registerXmtpActions = () => {
	registerAction("xbtify_create", async (ctx) => {
		await ctx.sendText(
			"🔍 Tag me (@xbtify.base.eth) and tell that you want to create an xbt of yourself\n\nE.g.\nHey @xbtify.base.eth clone myself",
		);
	});

	registerAction("open-app", async (ctx) => {
		await ctx.sendText(`💸 explore group stats on the app ${env.APP_URL}`);
	});
};

/**
 * Get XMTP actions
 * @param options - Optional configuration for the actions
 * @param options.message - Optional message to display with the actions
 * @param options.labels - Optional custom labels for the actions
 * @returns The actions
 */
export const getXmtpActions = (options?: {
	message?: string;
	labels?: {
		createXbt?: string;
		openApp?: string;
	};
}) => {
	const message = options?.message ?? ACTIONS_MESSAGE;
	const labels = options?.labels ?? {};

	return ActionBuilder.create("help", message)
		.add({
			id: "xbtify_create",
			label: labels.createXbt ?? "🤖 Create your XBT",
		})
		.add({ id: "open-app", label: labels.openApp ?? "🦊 Open App" })
		.build();
};

/**
 * Get XMTP transfer action for a transaction
 * @param actionMessage - The action message
 * @returns The action to transfer
 */
export const getXmtpTransferAction = ({
	actionMessage,
	agentAddress,
}: {
	actionMessage: string;
	agentAddress: Address;
}) => {
	const action = buildTransferAction({
		message: actionMessage,
		onTransfer: async (ctx) => {
			const senderAddress = await ctx.getSenderAddress();
			if (!senderAddress) {
				console.error("❌ Unable to get sender address");
				await ctx.sendText("❌ Unable to get sender address");
				return;
			}
			console.log(
				`Transfer of ${AGENT_TRANSFER_AMOUNT} USDC from ${senderAddress}`,
			);

			// check if a user has enough balance of the sell token
			const tokenBalance = await getBaseUsdcBalance({
				address: senderAddress as Address,
			});
			let sellAmount = AGENT_TRANSFER_AMOUNT;
			let sellAmountInDecimals = parseUnits(sellAmount.toString(), 6);

			const hasEnoughToken =
				BigInt(tokenBalance.balanceRaw) >= sellAmountInDecimals;
			const hasSomeToken = BigInt(tokenBalance.balanceRaw) > BigInt(0);

			console.log(
				`transfer ${AGENT_TRANSFER_AMOUNT} USDC ERC20 action`,
				JSON.stringify({
					senderAddress,
					tokenBalance,
					sellAmount,
					sellAmountInDecimals: sellAmountInDecimals.toString(),
					hasEnoughToken,
					hasSomeToken,
				}),
			);

			// if user balance is lower than the sell amount
			if (!hasEnoughToken) {
				// if user has no balance, return
				if (!hasSomeToken) {
					console.error("❌ User does not have enough balance");
					await ctx.sendText("❌ User does not have enough balance");
					return;
				}
				// if user has some token balance, use 50% of the balance for the transfer (base units)
				sellAmountInDecimals = BigInt(tokenBalance.balanceRaw) / BigInt(2);
				sellAmount = Number(sellAmountInDecimals) / 10 ** 6;
			}

			// get transfer ERC20 calls
			const walletSendCalls = transferERC20({
				from: senderAddress as Address,
				to: agentAddress,
				chainId: base.id,
				tokenAddress: BASE_USDC_ADDRESS as Address,
				tokenSymbol: "USDC",
				tokenDecimals: 6,
				amount: sellAmount,
				amountInDecimals: sellAmountInDecimals,
			});

			// send transfer ERC20 calls
			await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);
		},
	});
	return action;
};
