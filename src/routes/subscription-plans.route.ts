import { Router } from "express";

import * as subscriptionPlansController from "controllers/subscription-plans.controller";
import { requireAuth } from "middleware/auth.middleware";
import { asyncHandler } from "utils/catch-async";

const router = Router();

router.post("/", requireAuth, asyncHandler(subscriptionPlansController.createSubscriptionPlan));
router.get("/", requireAuth, asyncHandler(subscriptionPlansController.listSubscriptionPlans));
router.get("/:id", requireAuth, asyncHandler(subscriptionPlansController.getSubscriptionPlanById));
router.patch("/:id", requireAuth, asyncHandler(subscriptionPlansController.updateSubscriptionPlan));
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(subscriptionPlansController.deleteSubscriptionPlan)
);

export default router;
