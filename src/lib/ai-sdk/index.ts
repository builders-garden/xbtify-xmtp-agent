import { createOpenAI } from "@ai-sdk/openai";
import type { MessageContext } from "@xmtp/agent-sdk";
import { generateText } from "ai";
import { getAddress } from "viem";
import { ContentTypeActions } from "../../types/index.js";
import {
	getXmtpActions,
	getXmtpTransferAction,
	sendActions,
} from "../../utils/index.js";
import {
	DEFAULT_ACTIONS_MESSAGE,
	DEFAULT_RESPONSE_MESSAGE,
	SYSTEM_PROMPT,
} from "../constants.js";
import { env } from "../env.js";
import { tools } from "./tools.js";

const openai = createOpenAI({
	baseURL: "https://api.openai.com/v1",
	name: "openai",
	apiKey: env.OPENAI_API_KEY,
});

/**
 * Generate answer using AI
 * @param message - The message to generate answer for
 * @param messages - The messages to use as context
 * @returns
 */
export const aiGenerateAnswer = async ({
	message,
	senderAddress,
	xmtpContext,
}: {
	message: string;
	senderAddress: string;
	xmtpContext: MessageContext;
}): Promise<{
	answer?: string;
	user?: { fid?: number; username?: string; walletAddress: string };
}> => {
	// 1. generate text with ai
	const response = await generateText({
		model: openai("gpt-5-mini"),
		system: SYSTEM_PROMPT,
		messages: [
			{
				role: "assistant",
				content: `If the user wants to create a new xbt ai clone, user's eth wallet address is ${senderAddress}.`,
			},
			{
				role: "user",
				content: message,
			},
		],
		tools,
	});

	// 2. parse the output
	const outputStep = response.steps[0].content.find(
		(part) => part.type === "tool-result",
	);
	const textResponse = response.steps[0].content.find(
		(part) => part.type === "text",
	)?.text;

	console.log("Output Step:", outputStep);
	if (outputStep) {
		const outputText = (outputStep.output as string) ?? response.text;
		console.log("Output Text:", outputText);

		const toolName = outputStep.toolName;
		// 2.b track tool
		if (toolName === "xbtify_create") {
			const trackOutput = outputStep.output as unknown as {
				walletAddress: string;
				fid?: number;
				username?: string;
				text: string;
			};
			if (trackOutput.walletAddress) {
				const actionMessage = trackOutput.text
					? trackOutput.text
					: `Confirm to create a new xbt ai clone for this wallet address ${trackOutput.walletAddress}?`;
				const agentAddress = xmtpContext.getClientAddress();
				if (!agentAddress) {
					console.error("❌ Unable to get agent address");
					await xmtpContext.sendText("❌ Unable to get agent address");
					return { answer: undefined, user: undefined };
				}
				const actions = getXmtpTransferAction({
					actionMessage,
					agentAddress: getAddress(agentAddress),
				});
				await xmtpContext.conversation.send(actions, ContentTypeActions);
				return {
					answer: undefined,
					user: {
						fid: trackOutput.fid,
						username: trackOutput.username,
						walletAddress: trackOutput.walletAddress,
					},
				};
			}
			return {
				answer: trackOutput.text,
				user: {
					fid: undefined,
					username: undefined,
					walletAddress: trackOutput.walletAddress,
				},
			};
		}

		// 2.c default tool
		const xmtpActions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE });
		await sendActions(xmtpContext, xmtpActions);
		return { answer: undefined, user: undefined };
	}

	// 3. no tool call, return the text
	return { answer: textResponse ?? DEFAULT_RESPONSE_MESSAGE, user: undefined };
};
