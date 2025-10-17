import type { AgentMiddleware } from "@xmtp/agent-sdk";
import {
	ContentTypeReaction,
	type Reaction,
} from "@xmtp/content-type-reaction";
import type {
	InlineActionsContext,
	IntentContent,
	ThinkingReactionContext,
} from "../../types/index.js";
import { actionHandlers } from "../../utils/index.js";

/**
 * Middleware to handle intent messages and execute registered action handlers
 */
export const inlineActionsMiddleware: AgentMiddleware = async (ctx, next) => {
	if (ctx.message.contentType?.typeId === "intent") {
		const intentContent = ctx.message.content as IntentContent;
		const handler = actionHandlers.get(intentContent.actionId);

		console.log("🎯 Processing intent:", intentContent.actionId);
		if (handler) {
			try {
				// Attach params to context for handlers that need them
				(ctx as InlineActionsContext).metadata = intentContent.metadata;
				await handler(ctx);
			} catch (error) {
				console.error("❌ Error in action handler:", error);
				await ctx.sendText(
					`❌ Error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} else {
			await ctx.sendText(`❌ Unknown action: ${intentContent.actionId}`);
		}
		return;
	}
	await next();
};

/**
 * Middleware to add and remove thinking emoji reaction
 */
export const eyesReactionMiddleware: AgentMiddleware = async (ctx, next) => {
	try {
		// Step 1: Add helper function to add the eyes emoji reaction
		const addThinkingEmoji = async () => {
			await ctx.conversation.send(
				{
					action: "added",
					content: "👀",
					reference: ctx.message.id,
					schema: "shortcode",
				} as Reaction,
				ContentTypeReaction,
			);
		};

		// Step 2: Add helper function to remove the eyes emoji
		const removeThinkingEmoji = async () => {
			await ctx.conversation.send(
				{
					action: "removed",
					content: "👀",
					reference: ctx.message.id,
					schema: "shortcode",
				} as Reaction,
				ContentTypeReaction,
			);
		};

		// Attach helper to context
		(ctx as ThinkingReactionContext).helpers = {
			addThinkingEmoji,
			removeThinkingEmoji,
		};

		await next();
	} catch (error) {
		console.error("Error in thinking reaction middleware:", error);
		// Continue anyway
		await next();
	}
};
