import { Router } from "express";

import * as webhookController from "../controllers/webhook.controller";

const router = Router();

// WhatsApp webhook verification (GET) and event handler (POST)
router.get("/whatsapp", webhookController.verifyWebhook);
router.post("/whatsapp", webhookController.handleWebhook);

export default router;
