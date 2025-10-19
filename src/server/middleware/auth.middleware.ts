import type { NextFunction, Request, Response } from "express";
import { env } from "../../lib/env.js";
import { response } from "./response.js";

export const validateApiKey = (
	req: Request,
	_res: Response,
	next: NextFunction,
): void | Promise<void> => {
	if (env.NODE_ENV === "development") {
		next();
		return;
	}

	const authHeader = req.header("x-api-key");
	if (!authHeader) {
		console.log("Unauthorized: Invalid API key");
		response.unauthorized({
			message: "Unauthorized: Invalid API key",
		});
		return;
	}

	if (authHeader !== env.API_KEY) {
		console.log("Unauthorized: Invalid signature");
		response.unauthorized({
			message: "Unauthorized: Invalid signature",
		});
		return;
	}

	next();
};
