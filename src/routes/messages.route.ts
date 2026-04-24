import { Router } from "express";

import * as messagesController from "controllers/messages.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(messagesController.createMessage));
router.get("/", requireAuth, asyncHandler(messagesController.listMessages));
router.get("/:id", requireAuth, asyncHandler(messagesController.getMessageById));
router.patch("/:id", requireAuth, asyncHandler(messagesController.updateMessage));
router.delete("/:id", requireAuth, asyncHandler(messagesController.deleteMessage));

export default router;
