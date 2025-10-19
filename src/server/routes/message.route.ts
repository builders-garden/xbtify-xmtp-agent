import express from "express";
import { sendMessageController } from "../controllers/message.controller.js";

const router = express.Router();

router.post("/message", sendMessageController);

export default router;
