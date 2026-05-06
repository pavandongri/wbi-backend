import { Router } from "express";

import * as subscriptionsController from "controllers/subscriptions.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(subscriptionsController.createSubscription));
router.get("/", requireAuth, asyncHandler(subscriptionsController.listSubscriptions));
router.get("/:id", requireAuth, asyncHandler(subscriptionsController.getSubscriptionById));
router.patch("/:id", requireAuth, asyncHandler(subscriptionsController.updateSubscription));
router.delete("/:id", requireAuth, asyncHandler(subscriptionsController.deleteSubscription));

export default router;
