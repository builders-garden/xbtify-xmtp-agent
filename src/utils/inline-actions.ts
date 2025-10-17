import type { MessageContext } from "@xmtp/agent-sdk";
import { isAddress, isHex } from "viem";
import {
	type Action,
	type ActionsContent,
	ContentTypeActions,
} from "../types/index.js";

// Core types
export type ActionHandler = (ctx: MessageContext) => Promise<void>;

// Action registry
export const actionHandlers = new Map<string, ActionHandler>();

// Track the last sent action message for reply functionality
let lastSentActionMessage: unknown = null;

// Track the last shown menu for automatic navigation
let lastShownMenu: { config: AppConfig; menuId: string } | null = null;

export function registerAction(actionId: string, handler: ActionHandler): void {
	// Prevent overwriting existing handlers unless explicitly intended
	if (actionHandlers.has(actionId)) {
		console.warn(`⚠️ Action ${actionId} already registered, overwriting...`);
	}
	actionHandlers.set(actionId, handler);
}

// Get the last sent action message for reply functionality
export function getLastSentActionMessage(): unknown {
	return lastSentActionMessage;
}

// Clear all registered actions (useful for debugging)
export function clearAllActions(): void {
	actionHandlers.clear();
	console.log("🧹 Cleared all registered actions");
}

// Show the last shown menu
export async function showLastMenu(ctx: MessageContext): Promise<void> {
	if (lastShownMenu) {
		console.log(`🔄 Showing last menu: ${lastShownMenu.menuId}`);
		await showMenu(ctx, lastShownMenu.config, lastShownMenu.menuId);
	} else {
		console.warn("⚠️ No last menu to show, falling back to main menu");
		// Fallback to main menu if no last menu is tracked
		await ctx.sendText("Returning to main menu...");
	}
}

// Builder for creating actions
export class ActionBuilder {
	private actions: Action[] = [];
	private actionId = "";
	private actionDescription = "";

	static create(id: string, description: string): ActionBuilder {
		const builder = new ActionBuilder();
		builder.actionId = id;
		builder.actionDescription = description;
		return builder;
	}

	add({
		id,
		label,
		style,
		metadata,
	}: {
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
		metadata?: Record<string, unknown>;
	}): this {
		this.actions.push({ id, label, style, metadata });
		return this;
	}

	build(): ActionsContent {
		return {
			id: this.actionId,
			description: this.actionDescription,
			actions: this.actions,
		};
	}

	async send(ctx: MessageContext): Promise<void> {
		const message = await ctx.conversation.send(
			this.build(),
			ContentTypeActions,
		);
		lastSentActionMessage = message;
	}
}

// Helper functions
export async function sendActions(
	ctx: MessageContext,
	actionsContent: ActionsContent,
): Promise<void> {
	const message = await ctx.conversation.send(
		actionsContent,
		ContentTypeActions,
	);
	lastSentActionMessage = message;
}

/**
 * Send a confirmation menu
 * @param ctx - The message context
 * @param message - The message to send
 * @param onYes - The action to perform when the user clicks yes
 * @param onNo - The action to perform when the user clicks no
 * @returns void
 */
export async function sendConfirmation({
	ctx,
	message,
	onYes,
	onNo,
}: {
	ctx: MessageContext;
	message: string;
	onYes: ActionHandler;
	onNo?: ActionHandler;
}): Promise<void> {
	const timestamp = Date.now();
	const yesId = `confirm-${timestamp}`;
	const noId = `cancel-${timestamp}`;

	registerAction(yesId, onYes);
	registerAction(
		noId,
		onNo ||
			(async (ctx) => {
				await ctx.sendText("❌ Cancelled");
			}),
	);

	await ActionBuilder.create(`confirm-${timestamp}`, message)
		.add({ id: yesId, label: "✅ Confirm" })
		.add({ id: noId, label: "❌ Cancel", style: "danger" })
		.send(ctx);
}

/**
 * Send transfer actions
 * @param message - The message to send
 * @param onTransfer - The action to perform when the user clicks transfer
 * @returns void
 */
export function buildTransferAction({
	message,
	onTransfer,
}: {
	message: string;
	onTransfer: ActionHandler;
}) {
	const timestamp = Date.now();
	const transferId = `transfer-${timestamp}`;

	registerAction(transferId, onTransfer);

	return ActionBuilder.create(`transfer-${timestamp}`, message)
		.add({ id: transferId, label: "🤖 Pay for my XBT" })
		.build();
}

/**
 * Send a selection menu
 * @param ctx - The message context
 * @param message - The message to send
 * @param options - The options to send
 * @returns void
 */
export async function sendSelection({
	ctx,
	message,
	options,
}: {
	ctx: MessageContext;
	message: string;
	options: Array<{
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
		metadata?: Record<string, unknown>;
		handler: ActionHandler;
	}>;
}): Promise<void> {
	const builder = ActionBuilder.create(`selection-${Date.now()}`, message);

	options.forEach((option) => {
		registerAction(option.id, option.handler);
		builder.add({
			id: option.id,
			label: option.label,
			style: option.style,
			metadata: option.metadata,
		});
	});

	await builder.send(ctx);
}

// Validation helpers
export const validators = {
	inboxId: (input: string) => {
		return isHex(input.trim()) && input.trim().length === 64
			? { valid: true }
			: { valid: false, error: "Invalid Inbox ID format (64 hex chars)" };
	},

	ethereumAddress: (input: string) => {
		return isAddress(input.trim())
			? { valid: true }
			: {
					valid: false,
					error: "Invalid Ethereum address format (0x + 40 hex chars)",
				};
	},
};

// Common patterns
export const patterns = {
	inboxId: /^[a-fA-F0-9]{64}$/,
	ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
};

// Additional types needed by index.ts
export type MenuAction = {
	id: string;
	label: string;
	style?: "primary" | "secondary" | "danger";
	metadata?: Record<string, unknown>;
	handler?: ActionHandler;
	showNavigationOptions?: boolean;
};

export type Menu = {
	id: string;
	title: string;
	actions: MenuAction[];
};

export type AppConfig = {
	name: string;
	menus: Record<string, Menu>;
	options?: {
		autoShowMenuAfterAction?: boolean;
		defaultNavigationMessage?: string;
	};
};

// Utility functions needed by index.ts
export function getRegisteredActions(): string[] {
	return Array.from(actionHandlers.keys());
}

/**
 * Show a menu
 * @param ctx - The message context
 * @param config - The config to show the menu from
 * @param menuId - The id of the menu to show
 * @returns void
 */
export async function showMenu(
	ctx: MessageContext,
	config: AppConfig,
	menuId: string,
): Promise<void> {
	const menu = config.menus[menuId];
	if (!menu) {
		console.error(`❌ Menu not found: ${menuId}`);
		await ctx.sendText(`❌ Menu not found: ${menuId}`);
		return;
	}

	// Track the last shown menu
	lastShownMenu = { config, menuId };

	// Use a stable action ID without timestamp to prevent conflicts
	const builder = ActionBuilder.create(menuId, menu.title);

	menu.actions.forEach((action) => {
		builder.add({
			id: action.id,
			label: action.label,
			style: action.style,
			metadata: action.metadata,
		});
	});

	await builder.send(ctx);
}

// Configurable navigation helper
export async function showNavigationOptions(
	ctx: MessageContext,
	config: AppConfig,
	message: string,
	customActions?: Array<{
		id: string;
		label: string;
		style?: "primary" | "secondary" | "danger";
	}>,
): Promise<void> {
	// Check if auto-show menu is enabled (default: true for backward compatibility)
	const autoShowMenu = config.options?.autoShowMenuAfterAction !== false;

	if (!autoShowMenu) {
		// If auto-show is disabled, just send the message without showing menu
		await ctx.sendText(message);
		return;
	}

	// Use a stable action ID to prevent conflicts
	const navigationMenu = ActionBuilder.create("navigation-options", message);

	// Add custom actions if provided
	if (customActions) {
		customActions.forEach((action) => {
			navigationMenu.add({
				id: action.id,
				label: action.label,
				style: action.style,
			});
		});
	} else {
		// Default navigation options - show all main menu items
		const mainMenu = config.menus["main-menu"];
		if (mainMenu) {
			mainMenu.actions.forEach((action) => {
				navigationMenu.add({
					id: action.id,
					label: action.label,
					style: action.style,
				});
			});
		}
	}

	await navigationMenu.send(ctx);
}

/**
 * Initialize the app from a config
 * @param config - The config to initialize the app from
 * @param options
 */
export function initializeAppFromConfig(
	config: AppConfig,
	options?: {
		deferredHandlers?: Record<string, ActionHandler>;
	},
): void {
	console.log(`🚀 Initializing app: ${config.name}`);

	// Log configuration options
	if (config.options) {
		console.log("📋 App options:", config.options);
	}

	// Register all handlers from menu actions
	Object.values(config.menus).forEach((menu) => {
		menu.actions.forEach((action) => {
			if (action.handler) {
				// Wrap handler to automatically show last menu if showNavigationOptions is true
				const wrappedHandler = async (ctx: MessageContext) => {
					await action.handler?.(ctx);
					if (action.showNavigationOptions) {
						await showLastMenu(ctx);
					}
				};
				registerAction(action.id, wrappedHandler);
				console.log(
					`✅ Registered handler for action: ${action.id}${
						action.showNavigationOptions ? " (with auto-navigation)" : ""
					}`,
				);
			}
		});
	});

	// Register any deferred handlers
	if (options?.deferredHandlers) {
		Object.entries(options.deferredHandlers).forEach(([actionId, handler]) => {
			registerAction(actionId, handler);
			console.log(`✅ Registered deferred handler for action: ${actionId}`);
		});
	}

	// Auto-register menu navigation actions (for actions without handlers that match menu IDs)
	Object.values(config.menus).forEach((menu) => {
		menu.actions.forEach((action) => {
			if (!action.handler && config.menus[action.id]) {
				// This action navigates to another menu
				registerAction(action.id, async (ctx: MessageContext) => {
					await showMenu(ctx, config, action.id);
				});
				console.log(`✅ Auto-registered navigation for menu: ${action.id}`);
			}
		});
	});

	// Auto-register common navigation actions
	registerAction("main-menu", async (ctx: MessageContext) => {
		await showMenu(ctx, config, "main-menu");
	});

	registerAction("help", async (ctx: MessageContext) => {
		await showMenu(ctx, config, "main-menu");
	});

	registerAction("back-to-main", async (ctx: MessageContext) => {
		await showMenu(ctx, config, "main-menu");
	});
}
