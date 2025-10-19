import type { Group } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import cookieParserMiddleware from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morganLogger from "morgan";
import { base } from "viem/chains";
import { DEFAULT_ACTIONS_MESSAGE_2, WELCOME_MESSAGE } from "./lib/constants.js";
import { getOrCreateGroupByConversationId } from "./lib/db/queries/index.js";
import { env } from "./lib/env.js";
import { createXmtpAgent, handleXmtpMessage } from "./lib/xmtp/agent.js";
import {
	eyesReactionMiddleware,
	inlineActionsMiddleware,
} from "./lib/xmtp/middlewares.js";
import { validateApiKey } from "./server/middleware/auth.middleware.js";
import {
	handleError,
	handleNotFound,
} from "./server/middleware/error.middleware.js";
import responseMiddleware from "./server/middleware/response.js";
import messageRoutes from "./server/routes/message.route.js";
import { ContentTypeActions } from "./types/index.js";
import { getXmtpActions, registerXmtpActions } from "./utils/index.js";

async function main() {
	const app = express();
	const port = env.PORT;
	const allowedOrigins = ["*"];
	let server: ReturnType<typeof app.listen> | undefined;

	// Middlewares
	app.use(
		cors({
			origin: allowedOrigins,
			credentials: true,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		}),
	);
	app.use(cookieParserMiddleware());
	app.use(express.json());
	app.use(helmet());
	app.use(morganLogger("dev"));
	app.use(responseMiddleware);

	app.get("/", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.use("/api/send", validateApiKey, messageRoutes);

	// Use custom middlewares for handling 404 and errors
	app.use(handleNotFound);
	app.use(handleError);

	console.log("👽 XBTify XMTP Agent started 🗿");
	console.log(`📡 Connected to: ${base.name}`);

	// Create agent using environment variables
	const xmtpAgent = await createXmtpAgent();

	// get agent address
	const agentAddress = xmtpAgent.address;
	if (!agentAddress) {
		console.error("❌ Unable to get xmtp agent address");
		throw new Error("Unable to get xmtp agent address");
	}

	registerXmtpActions();

	// XMTP Agent middlewares
	xmtpAgent.use(inlineActionsMiddleware, eyesReactionMiddleware);

	xmtpAgent.on("message", async (ctx) => {
		console.log(`Message received: ${JSON.stringify(ctx.message.content)}`);
		await handleXmtpMessage(ctx, agentAddress);
	});

	xmtpAgent.on("group", async (ctx) => {
		const conversationId = ctx.conversation.id;
		console.log("Group received event", conversationId);
		const { group, isNew } = await getOrCreateGroupByConversationId(
			conversationId,
			ctx.conversation as Group,
			ctx.client.inboxId,
		);

		// If is new group, send welcome message and actions
		if (isNew) {
			console.log("Sending welcome message to new group", group.id);
			await ctx.conversation.send(WELCOME_MESSAGE);
			const actions = getXmtpActions({ message: DEFAULT_ACTIONS_MESSAGE_2 });
			await ctx.conversation.send(actions, ContentTypeActions);
		}
	});

	xmtpAgent.on("unknownMessage", async (ctx) => {
		console.log(`Unknown message received: ${JSON.stringify(ctx)}`);
	});

	xmtpAgent.on("unhandledError", async (ctx) => {
		console.log(`Unhandled error received: ${JSON.stringify(ctx)}`);
	});

	// Handle startup
	xmtpAgent.on("start", async () => {
		console.log("👽 XBTify XMTP Agent is running...");
		logDetails(xmtpAgent.client);
	});

	await xmtpAgent.start();

	// Start HTTP server and capture handle for graceful shutdown
	server = app.listen(port, () => {
		console.log(`🚀 Express.js server is running at http://localhost:${port}`);
	});

	// Unified graceful shutdown
	let isShuttingDown = false;
	const shutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		console.log(`${signal} received, shutting down...`);

		const tasks: Array<Promise<unknown>> = [];

		// Close HTTP server
		tasks.push(
			new Promise<void>((resolve) => {
				if (!server) return resolve();
				server.close(() => resolve());
			}),
		);

		// Stop XMTP Agent
		try {
			tasks.push(xmtpAgent.stop?.() ?? Promise.resolve());
		} catch {}

		await Promise.allSettled(tasks);
		console.log("Shutdown complete. Exiting.");
		setTimeout(() => process.exit(0), 100).unref();
	};

	process.on("SIGINT", () => void shutdown("SIGINT"));
	process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
	console.error(error);
	throw error;
});
