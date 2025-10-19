import type { Request, Response } from "express";
import { z } from "zod";
import { getUserFromFid } from "../../lib/db/queries/user.query.js";
import { createXmtpAgent } from "../../lib/xmtp/agent.js";

const sendMessageSchema = z.object({
	message: z.string().min(1),
	userFid: z.number().min(1),
});

export type SendMessageSchema = z.infer<typeof sendMessageSchema>;

export const sendMessageController = async (req: Request, res: Response) => {
	try {
		const parsedBody = sendMessageSchema.safeParse(req.body);
		if (!parsedBody.success) {
			console.error("Invalid request body", parsedBody.error.message);
			return res.status(400).json({
				message: "Invalid request body",
				error: parsedBody.error.message,
			});
		}
		const { message, userFid } = parsedBody.data;
		const user = await getUserFromFid(userFid);
		if (!user) {
			return res.status(404).json({
				message: "User not found",
			});
		}
		if (!user.inboxId) {
			return res.status(200).json({
				message: "User does not have an inbox ID",
			});
		}
		const xmtpAgent = await createXmtpAgent();
		await xmtpAgent.client.conversations.sync();

		const agentAddress = xmtpAgent.address;
		if (!agentAddress) {
			console.error("❌ Unable to get xmtp agent address");
			return {
				status: "failed",
				error: "Unable to get xmtp agent address",
			};
		}

		let dm = xmtpAgent.client.conversations.getDmByInboxId(user.inboxId);
		if (!dm) {
			dm = await xmtpAgent.client.conversations.newDm(user.inboxId);
		}

		await dm.send(message);

		return res.status(200).json({
			status: "ok",
		});
	} catch (error) {
		console.error("Error sending message:", error);
		return res.status(500).json({
			message: "Failed to send message",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};
