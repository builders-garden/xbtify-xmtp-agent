import { Agent, filter, type MessageContext } from "@xmtp/agent-sdk";
import type { GroupUpdated } from "@xmtp/content-type-group-updated";
import { GroupUpdatedCodec } from "@xmtp/content-type-group-updated";
import { MarkdownCodec } from "@xmtp/content-type-markdown";
import type { Reaction } from "@xmtp/content-type-reaction";
import { ReactionCodec } from "@xmtp/content-type-reaction";
import type { RemoteAttachment } from "@xmtp/content-type-remote-attachment";
import { RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import type { Reply } from "@xmtp/content-type-reply";
import { ReplyCodec } from "@xmtp/content-type-reply";
import {
	type TransactionReference,
	TransactionReferenceCodec,
} from "@xmtp/content-type-transaction-reference";
import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import {
	type Address,
	erc20Abi,
	formatUnits,
	getAddress,
	type Hex,
	isHex,
	parseEventLogs,
	parseUnits,
} from "viem";
import type {
	ActionsContent,
	GroupUpdatedMessage,
	IntentContent,
	ThinkingReactionContext,
} from "../../types/index.js";
import {
	ActionsCodec,
	ContentTypeActions,
	IntentCodec,
} from "../../types/index.js";
import {
	getEncryptionKeyFromString,
	getXmtpActions,
	sendActions,
} from "../../utils/index.js";
import {
	extractMessageContent,
	handleGroupUpdated,
	shouldRespondToMessage,
	shouldSendHelpHint,
} from "../../utils/message.util.js";
import { getTransactionReceipt } from "../../utils/viem.util.js";
import { aiGenerateAnswer } from "../ai-sdk/index.js";
import {
	AGENT_TRANSFER_AMOUNT,
	BASE_USDC_ADDRESS,
	DEFAULT_ACTIONS_MESSAGE_2,
	HELP_HINT_MESSAGE,
	WELCOME_MESSAGE,
} from "../constants.js";
import {
	checkIfTxHashAlreadyUsed,
	getOrCreateDmByConversationId,
	getOrCreateGroupByConversationId,
	setUserPaidTxHash,
} from "../db/queries/index.js";
import { env } from "../env.js";

/**
 * Get the XMTP agent
 * @returns The XMTP agent
 */
export const createXmtpAgent = async () => {
	const dbEncryptionKey = env.XMTP_DB_ENCRYPTION_KEY
		? getEncryptionKeyFromString(env.XMTP_DB_ENCRYPTION_KEY)
		: undefined;
	const customDbPath = (inboxId: string) =>
		`${env.RAILWAY_VOLUME_MOUNT_PATH}/${env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`;

	return Agent.createFromEnv({
		env: env.XMTP_ENV,
		dbEncryptionKey,
		dbPath: customDbPath,
		codecs: [
			new ReplyCodec(),
			new GroupUpdatedCodec(),
			new WalletSendCallsCodec(),
			new ActionsCodec(),
			new IntentCodec(),
			new ReactionCodec(),
			new RemoteAttachmentCodec(),
			new MarkdownCodec(),
			new TransactionReferenceCodec(),
		],
	});
};

/**
 * Handle XMTP message
 * @param ctx - The message context
 */
export const handleXmtpMessage = async (
	ctx: MessageContext<
		| string
		| IntentContent
		| Reply
		| WalletSendCallsParams
		| ActionsContent
		| GroupUpdated
		| Reaction
		| RemoteAttachment
		| TransactionReference
	>,
	agentAddress: string,
) => {
	try {
		const thinkingContext = ctx as ThinkingReactionContext;

		// skip if message has no content or is from the agent or its a reaction
		if (
			!filter.hasContent(ctx.message) ||
			filter.fromSelf(ctx.message, ctx.client) ||
			ctx.message.contentType?.typeId === "reaction"
		) {
			console.log("Skipping message");
			return;
		}

		// Handle DM messages like a group with one member
		if (ctx.isDm()) {
			console.log("Handling DM message");
			const conversationId = ctx.conversation.id;
			const senderAddress = await ctx.getSenderAddress();
			const inboxId = ctx.conversation.peerInboxId;
			if (!senderAddress) {
				console.error("Wallet address not found");
				return;
			}

			await thinkingContext.helpers.addThinkingEmoji();

			const { group, isNew } = await getOrCreateDmByConversationId(
				conversationId,
				getAddress(senderAddress),
				inboxId,
			);

			if (isNew) {
				console.log("Sending welcome message to new dm", group.id);
				await ctx.conversation.send(WELCOME_MESSAGE);
				const actions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE_2 });
				await ctx.conversation.send(actions, ContentTypeActions);
				return;
			}

			const messageContent = extractMessageContent(ctx.message);
			const answer = await aiGenerateAnswer({
				message: messageContent,
				senderAddress,
				xmtpContext: ctx,
			});
			console.log("answer from ai", answer);
			if (answer.answer) {
				await ctx.sendTextReply(answer.answer);
			}
		}

		// Handle group messages
		if (ctx.isGroup()) {
			console.log("Handling group message");
			const conversationId = ctx.conversation.id;
			const { group, isNew } = await getOrCreateGroupByConversationId(
				conversationId,
				ctx.conversation,
				ctx.client.inboxId,
			);
			console.log("group", group.id, "isNew:", isNew);

			// Handle group updates
			if (ctx.message.contentType?.typeId === "group_updated") {
				console.log(
					"Group updated message received",
					JSON.stringify(ctx.message),
				);
				const xmtpMessage = ctx.message as GroupUpdatedMessage;
				const xmtpMembers = await ctx.conversation.members();
				handleGroupUpdated({
					group,
					xmtpMessage,
					xmtpMembers,
					agentAddress,
					agentInboxId: ctx.client.inboxId,
				});
			}

			if (isNew) {
				// welcome message already handled in the "group" event listener
			}

			// Handle reply to the agent
			const messageContent = extractMessageContent(ctx.message);
			const isSendHelpHint = shouldSendHelpHint(messageContent);
			const shouldRespond = await shouldRespondToMessage({
				message: ctx.message,
				agentInboxId: ctx.client.inboxId,
				client: ctx.client,
			});
			if (shouldRespond) {
				await thinkingContext.helpers.addThinkingEmoji();
				if (isSendHelpHint) {
					await ctx.sendTextReply(HELP_HINT_MESSAGE);
					const actions = getXmtpActions();
					await sendActions(ctx, actions);
					return;
				}

				// get only the reply message in context for the ai
				if (ctx.isReply()) {
					const replyMessage = ctx.message.content;
					console.log("reply message", replyMessage);
				}

				const senderAddress = await ctx.getSenderAddress();
				if (!senderAddress) {
					console.error("Sender address not found");
					return;
				}
				// generate answer from ai service
				const answer = await aiGenerateAnswer({
					message: messageContent,
					senderAddress,
					xmtpContext: ctx,
				});
				console.log("answer from ai", answer);
				if (answer.answer) {
					await ctx.sendTextReply(answer.answer);
				}
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Error processing message:", errorMessage);
	}
};

/**
 * Handle payment received in XMTP transaction reference
 * @param transactionReference - The transaction reference
 * @param senderAddress - The sender address
 * @param agentAddress - The agent address
 * @returns true if the payment is valid, false otherwise
 */
export const handlePaymentReceived = async ({
	transactionReference,
	senderAddress,
	agentAddress,
}: {
	transactionReference: TransactionReference;
	senderAddress: Address;
	agentAddress: Address;
}): Promise<boolean> => {
	try {
		const txHash = transactionReference.reference;
		if (!isHex(txHash)) {
			console.error("Transaction hash is not a valid hex");
			return false;
		}

		// 1. get transaction receipt from base
		const txReceipt = await getTransactionReceipt(txHash as Hex);
		if (!txReceipt) {
			console.error(`Transaction not found ${txHash}`);
			return false;
		}
		if (txReceipt.status !== "success") {
			console.error("Transaction failed", txHash);
			return false;
		}

		// 2. parse erc20 logs for the transfer event
		const logs = parseEventLogs({
			abi: erc20Abi,
			eventName: ["Transfer"],
			args: {
				from: senderAddress,
				to: agentAddress,
				value: parseUnits(AGENT_TRANSFER_AMOUNT.toString(), 6), // USDC has 6 decimals
			},
			logs: txReceipt.logs,
		});

		// 3. check erc20 logs for transfer event
		const transferEvent = logs.find((log) => log.eventName === "Transfer");
		if (!transferEvent) {
			console.error("Transfer event not found");
			return false;
		}
		const contractAddress = transferEvent.address;
		const amount = formatUnits(BigInt(transferEvent.args.value), 6);
		const from = getAddress(transferEvent.args.from);
		const to = getAddress(transferEvent.args.to);
		console.log("from", from, "to", to, "amount", amount, transferEvent);

		// check contract address is Base USDC
		if (contractAddress !== BASE_USDC_ADDRESS) {
			console.error(`Contract address is not Base USDC: ${contractAddress}`);
			return false;
		}
		// check sender is the same as the one in the message
		if (from !== senderAddress) {
			console.error("Sender address not found in transfer event");
			return false;
		}
		// check destination is agent address
		if (to !== agentAddress) {
			console.error("Agent address not found in transfer event");
			return false;
		}
		// check amount is gte the 5 USDC amount
		if (Number.parseFloat(amount) >= Number(AGENT_TRANSFER_AMOUNT)) {
			console.log(`✅ Received ${amount} USDC on transaction ${txHash}!`);
		} else {
			console.log(
				`❌ Received ${amount} USDC, but it's less than ${AGENT_TRANSFER_AMOUNT} USDC on transaction ${transferEvent.transactionHash}`,
			);
		}

		// 4. check this txHash has not been used already
		const alreadyUsed = await checkIfTxHashAlreadyUsed(txHash);
		if (alreadyUsed) {
			console.error(`Transaction hash has already been used: ${txHash}`);
			return false;
		}

		// 5. set the paid transaction hash for the user
		await setUserPaidTxHash(senderAddress, txHash);
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Error handling payment received:", errorMessage);
		return false;
	}
};
